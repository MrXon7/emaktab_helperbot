import os
import io
import time
import asyncio
import logging
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy.orm import Session
from aiogram import types
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from config import settings
from bot import bot, dp
from database import init_db, get_db, User, Student, SubscriptionOrder, SystemSetting
from auth import get_current_user, require_active_subscription
from emaktab_service import EmaktabService
from excel_parser import ExcelParser
from keep_alive import keep_alive

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

# Oddiy in-memory rate limiter: {user_id: [timestamp1, timestamp2, ...]}
# 60 soniya ichida har bir foydalanuvchi uchun max 5 ta /api/login-single so'rovi
_rate_limit_store: dict[int, list[float]] = {}
RATE_LIMIT_WINDOW = 60    # soniya
RATE_LIMIT_MAX    = 5     # so'rovlar soni

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Supabase jadvallarini tekshirish/yaratish
    try:
        init_db()
    except Exception as e:
        logger.error(f"DB Startup error: {e}")

    # 2. Webhook sozlash (agar token bo'lsa)
    if bot and settings.BOT_TOKEN:
        webhook_url = f"{settings.WEBAPP_URL.rstrip('/')}/webhook"
        try:
            await bot.set_webhook(url=webhook_url, drop_pending_updates=False)
            logger.info(f"Telegram Webhook o'rnatildi: {webhook_url}")
        except Exception as e:
            logger.warning(f"Webhook o'rnatilmadi: {e}")

    # 3. Har 5 daqiqada serverni uyg'oq tutuvchi Keep-Alive oqimini ishga tushirish
    keep_alive()

    yield
    
    # Shutdown
    if bot and settings.BOT_TOKEN:
        try:
            await bot.session.close()
            logger.info("Telegram Bot sessiyasi yopildi.")
        except Exception as e:
            logger.error(f"Botni to'xtatishda xatolik: {e}")

app = FastAPI(title="eMaktab Helper Multi-User", lifespan=lifespan)

# Statik fayllar va shablonlar
static_dir = os.path.join(BASE_DIR, "static")
templates_dir = os.path.join(BASE_DIR, "templates")

app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=templates_dir)

# Schemas
class StudentCreateOrUpdateRequest(BaseModel):
    name: str
    schoolName: str = "Maktab"
    grade: str = "1-A"
    login: str
    password: str
    parentLogin: str = ""
    parentPassword: str = ""

class StudentLoginRequest(BaseModel):
    id: str
    name: str
    login: str
    password: str
    parentLogin: str = ""
    parentPassword: str = ""
    schoolName: str = "Maktab"
    grade: str = "1-A"

class UserRegisterRequest(BaseModel):
    fullName: str
    phone: str
    schoolName: str
    grade: str
    region: str = ""

class SubscriptionOrderCreateRequest(BaseModel):
    studentsCount: int
    quartersCount: int
    durationDays: int
    amountUzs: int

class AdminSettingsUpdateRequest(BaseModel):
    pricePerStudentQuarter: str
    cardNumber: str
    cardHolder: str
    adminTelegramContact: str

class AdminOrderActionRequest(BaseModel):
    reason: str = ""

def is_admin_user(user: User) -> bool:
    """Foydalanuvchi admin ekanligini tekshirish"""
    if not user.telegram_id:
        return False
    admin_str_ids = [str(a) for a in settings.ADMIN_IDS]
    if user.telegram_id in admin_str_ids:
        return True
    if user.telegram_id.startswith("dev_") and settings.ENVIRONMENT != "production":
        return True
    return False

async def require_admin(user: User = Depends(get_current_user)) -> User:
    """Admin huquqini talab qiluvchi dependency"""
    if not is_admin_user(user):
        raise HTTPException(
            status_code=403, 
            detail="Ushbu bo'lim faqat administratorlar uchun mo'ljallangan."
        )
    return user

@app.get("/", response_class=HTMLResponse)
async def serve_webapp(request: Request):
    """Telegram Mini App bosh sahifasi"""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"request": request}
    )

@app.get("/health")
async def health_check():
    return {"status": "ok", "app": "eMaktab Helper Multi-User", "database": "Supabase PostgreSQL"}

@app.get("/api/me")
async def get_me(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Foydalanuvchi ma'lumotlari, profili va obuna holati"""
    student_count = db.query(Student).filter(Student.user_id == user.id).count()
    profile = user.profile_dict()
    profile["studentCount"] = student_count
    profile["isAdmin"] = is_admin_user(user)
    return profile


@app.get("/api/download-template")
async def download_template():
    """Namuna Excel (.xlsx) faylini yuklab olish"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "O'quvchilar"

    headers = [
        "F.I.Sh (Ism Familiya)", 
        "Maktab", 
        "Sinf", 
        "O'quvchi Logini", 
        "O'quvchi Paroli", 
        "Ota-ona Logini", 
        "Ota-ona Paroli"
    ]
    ws.append(headers)

    samples = [
        ["Aliyev Vali G'aniyevich", "56-Maktab", "5-A", "ali_valiyev_5a", "Parol123!", "ota_valiyev_5a", "OtaParol123!"],
        ["Karimova Madina Rustam qizi", "56-Maktab", "5-A", "madina_k_5a", "Madina2026", "ona_karimova_5a", "OnaParol2026"],
        ["Toshmatov Dilshod Akrom o'g'li", "56-Maktab", "6-B", "dilshod_t_6b", "Dilshod_123", "ota_toshmatov_6b", "DilshodOta1"]
    ]
    for row in samples:
        ws.append(row)

    header_fill = PatternFill(start_color="0D6EFD", end_color="0D6EFD", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    
    for col_idx, col_name in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = 26

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=emaktab_oquvchilar_namuna.xlsx"}
    )

@app.get("/api/students")
async def get_students(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Joriy foydalanuvchining o'quvchilari (7 kunlik muddati tekshirilgan holda)"""
    students = db.query(Student).filter(Student.user_id == user.id).order_by(Student.created_at.desc()).all()
    
    now_ms = int(time.time() * 1000)
    has_expired = False

    result = []
    for s in students:
        # 7 kunlik tekshiruv
        if s.status == "success" and s.success_at:
            if (now_ms - s.success_at) >= SEVEN_DAYS_MS:
                s.status = "pending"
                s.message = "1 hafta o'tgani sababli qayta kutilmoqda"
                has_expired = True
        result.append(s.to_dict())

    if has_expired:
        db.commit()

    return {"students": result}

@app.post("/api/upload-excel")
async def upload_excel(
    file: UploadFile = File(...),
    user: User = Depends(require_active_subscription),
    db: Session = Depends(get_db)
):
    """Excel yuklash va foydalanuvchi nomiga Supabase'ga saqlash (obuna va limit tekshiriladi)"""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Faqat .xlsx yoki .xls fayllar qabul qilinadi")

    try:
        content = await file.read()
        parsed_students = ExcelParser.parse_excel_bytes(content)

        # Limit tekshiruvi
        current_count = db.query(Student).filter(Student.user_id == user.id).count()
        slots_left = user.max_students - current_count
        if slots_left <= 0:
            raise HTTPException(
                status_code=403,
                detail=f"O'quvchilar limiti to'ldi ({user.max_students} ta). "
                       "Ko'proq o'quvchi qo'shish uchun obunani yangilang."
            )

        # Limit oshib ketmasligi uchun qisqartirish
        students_to_add = parsed_students[:slots_left]
        skipped = len(parsed_students) - len(students_to_add)

        saved_students = []
        for item in students_to_add:
            student = Student(
                id=item["id"],
                user_id=user.id,
                name=item["name"],
                school_name=item["schoolName"],
                grade=item["grade"],
                login=item["login"],
                password=item["password"],
                parent_login=item.get("parentLogin", "").strip(),
                parent_password=item.get("parentPassword", "").strip(),
                status="pending",
                message=""
            )
            db.add(student)
            saved_students.append(student.to_dict())

        db.commit()
        return {
            "success": True,
            "count": len(saved_students),
            "skipped": skipped,
            "students": saved_students
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Excel parsing va DB saqlash xatosi")
        raise HTTPException(status_code=500, detail=f"Faylni saqlashda xatolik: {str(e)}")

@app.post("/api/students")
async def create_student(
    req: StudentCreateOrUpdateRequest,
    user: User = Depends(require_active_subscription),
    db: Session = Depends(get_db)
):
    """Qo'lda yangi o'quvchi qo'shish (obuna va limit tekshiriladi)"""
    # Limit tekshiruvi
    current_count = db.query(Student).filter(Student.user_id == user.id).count()
    if current_count >= user.max_students:
        raise HTTPException(
            status_code=403,
            detail=f"O'quvchilar limiti to'ldi ({user.max_students} ta). "
                   "Ko'proq o'quvchi qo'shish uchun obunani yangilang."
        )

    student_id = f"std_{int(time.time() * 1000)}_{os.urandom(2).hex()}"
    student = Student(
        id=student_id,
        user_id=user.id,
        name=req.name.strip(),
        school_name=req.schoolName.strip() or "Maktab",
        grade=req.grade.strip() or "1-A",
        login=req.login.strip(),
        password=req.password.strip(),
        parent_login=req.parentLogin.strip(),
        parent_password=req.parentPassword.strip(),
        status="pending",
        message=""
    )
    db.add(student)
    db.commit()
    db.refresh(student)
    return {"success": True, "student": student.to_dict()}

@app.put("/api/students/{student_id}")
async def update_student(
    student_id: str,
    req: StudentCreateOrUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """O'quvchini tahrirlash (faqat o'ziga tegishlisini)"""
    student = db.query(Student).filter(Student.id == student_id, Student.user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="O'quvchi topilmadi")

    student.name = req.name.strip()
    student.school_name = req.schoolName.strip() or "Maktab"
    student.grade = req.grade.strip() or "1-A"
    student.login = req.login.strip()
    student.password = req.password.strip()
    student.parent_login = req.parentLogin.strip()
    student.parent_password = req.parentPassword.strip()
    student.status = "pending"
    student.message = "Ma'lumotlar tahrirlandi"
    
    db.commit()
    db.refresh(student)
    return {"success": True, "student": student.to_dict()}

@app.delete("/api/students/{student_id}")
async def delete_student(
    student_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """O'quvchini o'chirish"""
    student = db.query(Student).filter(Student.id == student_id, Student.user_id == user.id).first()
    if not student:
        raise HTTPException(status_code=404, detail="O'quvchi topilmadi")

    db.delete(student)
    db.commit()
    return {"success": True, "message": "O'quvchi o'chirildi"}

@app.post("/api/login-single")
async def login_single(
    student_req: StudentLoginRequest,
    user: User = Depends(require_active_subscription),
    db: Session = Depends(get_db)
):
    """Bitta o'quvchiga emaktab.uz orqali kirish (obuna + rate limit tekshiriladi)"""
    # Rate limit tekshiruvi
    now_ts = time.time()
    history = _rate_limit_store.get(user.id, [])
    history = [ts for ts in history if now_ts - ts < RATE_LIMIT_WINDOW]
    if len(history) >= RATE_LIMIT_MAX:
        wait_sec = int(RATE_LIMIT_WINDOW - (now_ts - history[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Juda ko'p so'rov. {wait_sec} soniyadan so'ng qayta urinib ko'ring."
        )
    history.append(now_ts)
    _rate_limit_store[user.id] = history

    result = await EmaktabService.process_student_login(student_req.model_dump())

    # Bazadagi statusni yangilash
    student = db.query(Student).filter(Student.id == student_req.id, Student.user_id == user.id).first()
    if student:
        student.status = result["status"]
        student.message = result.get("message", "")
        if result["status"] == "success":
            student.success_at = int(time.time() * 1000)
        db.commit()

    return result

# ─── SINF RAHBAR RO'YXATDAN O'TISH VA OBUNA BUYURTMA ENDPOINTLARI ─────────────

@app.post("/api/register")
async def register_profile(
    req: UserRegisterRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Sinf rahbar profilini to'ldirish / ro'yxatdan o'tish"""
    user.full_name = req.fullName.strip()
    user.phone = req.phone.strip()
    user.school_name = req.schoolName.strip()
    user.grade = req.grade.strip()
    user.region = req.region.strip()
    user.is_registered = True
    db.commit()
    db.refresh(user)
    return {"success": True, "user": user.profile_dict()}

@app.get("/api/settings/public")
async def get_public_settings(db: Session = Depends(get_db)):
    """Sinf rahbarlar uchun ommaviy to'lov va choraklik narx sozlamalari"""
    price_val = SystemSetting.get(db, "price_per_student_quarter", "2000")
    try:
        price_num = int(price_val)
    except ValueError:
        price_num = 2000

    return {
        "pricePerStudentQuarter": price_num,
        "cardNumber": SystemSetting.get(db, "card_number", "9860 1234 5678 9012"),
        "cardHolder": SystemSetting.get(db, "card_holder", "ADMIN ISM FAMILIYA"),
        "adminTelegramContact": SystemSetting.get(db, "admin_telegram_contact", "@emaktabro_bot")
    }

@app.post("/api/subscription-orders")
async def create_subscription_order(
    req: SubscriptionOrderCreateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Yangi obuna/to'lov so'rovi yuborish va adminlarga bot orqali bildirishnoma jo'natish"""
    order = SubscriptionOrder(
        user_id=user.id,
        students_count=req.studentsCount,
        quarters_count=req.quartersCount,
        duration_days=req.durationDays,
        amount_uzs=req.amountUzs,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Adminlarga Telegram bot orqali bildirishnoma yuborish
    if bot and settings.BOT_TOKEN and settings.ADMIN_IDS:
        teacher_name = user.full_name or user.first_name or "Foydalanuvchi"
        school = user.school_name or "Ko'rsatilmagan"
        grade = user.grade or ""
        phone = user.phone or "Ko'rsatilmagan"
        
        notice_text = (
            f"🔔 <b>Yangi to'lov so'rovi!</b>\n\n"
            f"👤 <b>O'qituvchi:</b> {teacher_name}\n"
            f"🏫 <b>Maktab:</b> {school} {grade}\n"
            f"📞 <b>Telefon:</b> {phone}\n"
            f"🆔 <b>Telegram ID:</b> <code>{user.telegram_id}</code>\n"
            f"👨‍🎓 <b>O'quvchilar soni:</b> {req.studentsCount} ta\n"
            f"📅 <b>Muddat:</b> {req.quartersCount}-chorak ({req.durationDays} kun)\n"
            f"💰 <b>To'lov summasi:</b> {req.amountUzs:,} so'm\n\n"
            f"📲 <i>Mini App ichidagi <b>'Admin Boshqaruvi'</b> bo'limidan tasdiqlashingiz mumkin.</i>"
        )
        for admin_id in settings.ADMIN_IDS:
            try:
                await bot.send_message(admin_id, notice_text, parse_mode="HTML")
            except Exception as e:
                logger.warning(f"Admin {admin_id} ga to'lov bildirishnomasi yuborilmadi: {e}")

    return {"success": True, "order": order.to_dict()}

@app.get("/api/subscription-orders/my")
async def get_my_latest_order(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Foydalanuvchining so'nggi to'lov so'rovi holati"""
    order = db.query(SubscriptionOrder).filter(
        SubscriptionOrder.user_id == user.id
    ).order_by(SubscriptionOrder.created_at.desc()).first()
    return {"order": order.to_dict() if order else None}


# ─── ADMIN BOSHQARUV PANEL ENDPOINTLARI (FAQAT ADMINLAR UCHUN) ────────────────

@app.get("/api/admin/orders")
async def admin_get_orders(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Barcha to'lov so'rovlari ro'yxati (Admin)"""
    orders = db.query(SubscriptionOrder).order_by(
        SubscriptionOrder.created_at.desc()
    ).limit(100).all()
    return {"orders": [o.to_dict() for o in orders]}

@app.post("/api/admin/orders/{order_id}/approve")
async def admin_approve_order(
    order_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """To'lov so'rovini tasdiqlash va obunani faollashtirish (Admin)"""
    order = db.query(SubscriptionOrder).filter(SubscriptionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="So'rov topilmadi")

    order.status = "approved"
    order.processed_at = datetime.utcnow()

    # O'qituvchining obunasini yangilash
    teacher = db.query(User).filter(User.id == order.user_id).first()
    if teacher:
        now = datetime.utcnow()
        base_date = teacher.expires_at if (teacher.expires_at and teacher.expires_at > now) else now
        teacher.expires_at = base_date + timedelta(days=order.duration_days)
        teacher.plan = "active"
        teacher.max_students = order.students_count
        db.commit()

        # O'qituvchiga bot orqali tabriknoma jo'natish
        if bot and settings.BOT_TOKEN and teacher.telegram_id and not teacher.telegram_id.startswith("dev_"):
            try:
                await bot.send_message(
                    int(teacher.telegram_id),
                    f"🎉 <b>Tabriklaymiz, to'lovingiz tasdiqlandi!</b>\n\n"
                    f"Obunangiz <b>{order.quarters_count}-chorak</b> ({order.duration_days} kun) ga faollashtirildi.\n"
                    f"👨‍🎓 <b>Ruxsat etilgan o'quvchilar:</b> {order.students_count} ta\n"
                    f"📅 <b>Tugash sanasi:</b> {teacher.expires_at.strftime('%d.%m.%Y')}\n\n"
                    f"Endi EduFlow Avto Mini App orqali barcha imkoniyatlardan to'liq foydalanishingiz mumkin!",
                    parse_mode="HTML"
                )
            except Exception as e:
                logger.warning(f"O'qituvchi {teacher.telegram_id} ga tasdiqlash xabari bormadi: {e}")
    else:
        db.commit()

    return {"success": True, "order": order.to_dict()}

@app.post("/api/admin/orders/{order_id}/reject")
async def admin_reject_order(
    order_id: int,
    req: AdminOrderActionRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """To'lov so'rovini rad etish (Admin)"""
    order = db.query(SubscriptionOrder).filter(SubscriptionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="So'rov topilmadi")

    order.status = "rejected"
    order.reject_reason = req.reason or "To'lov cheki tasdiqlanmadi"
    order.processed_at = datetime.utcnow()
    db.commit()

    teacher = db.query(User).filter(User.id == order.user_id).first()
    if bot and settings.BOT_TOKEN and teacher and teacher.telegram_id and not teacher.telegram_id.startswith("dev_"):
        try:
            await bot.send_message(
                int(teacher.telegram_id),
                f"⚠️ <b>To'lov so'rovingiz rad etildi</b>\n\n"
                f"Sabab: {order.reject_reason}\n\n"
                f"Savollaringiz bo'lsa admin bilan bog'laning: @emaktabro_bot",
                parse_mode="HTML"
            )
        except Exception as e:
            logger.warning(f"Xabar yuborilmadi: {e}")

    return {"success": True, "order": order.to_dict()}

@app.get("/api/admin/settings")
async def admin_get_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Barcha tizim sozlamalarini olish (Admin)"""
    return {
        "price_per_student_quarter": SystemSetting.get(db, "price_per_student_quarter", "2000"),
        "card_number": SystemSetting.get(db, "card_number", "9860 1234 5678 9012"),
        "card_holder": SystemSetting.get(db, "card_holder", "ADMIN ISM FAMILIYA"),
        "admin_telegram_contact": SystemSetting.get(db, "admin_telegram_contact", "@emaktabro_bot")
    }

@app.put("/api/admin/settings")
async def admin_update_settings(
    req: AdminSettingsUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Tizim sozlamalari va narxlarini yangilash (Admin)"""
    SystemSetting.set(db, "price_per_student_quarter", req.pricePerStudentQuarter.strip())
    SystemSetting.set(db, "card_number", req.cardNumber.strip())
    SystemSetting.set(db, "card_holder", req.cardHolder.strip())
    SystemSetting.set(db, "admin_telegram_contact", req.adminTelegramContact.strip())
    return {"success": True, "message": "Sozlamalar muvaffaqiyatli saqlandi"}

@app.get("/api/admin/users")
async def admin_get_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Barcha sinf rahbarlar ro'yxati (Admin)"""
    users = db.query(User).order_by(User.created_at.desc()).limit(100).all()
    result = []
    for u in users:
        s_count = db.query(Student).filter(Student.user_id == u.id).count()
        prof = u.profile_dict()
        prof["studentCount"] = s_count
        result.append(prof)
    return {"users": result}

@app.post("/webhook")
async def telegram_webhook(request: Request):
    """Telegram Bot Webhook endpointi"""
    if not bot:
        return JSONResponse({"status": "Bot token not configured"}, status_code=200)
    
    try:
        data = await request.json()
        update = types.Update(**data)
        await dp.feed_update(bot, update)
    except Exception as e:
        logger.error(f"Webhook xatosi: {e}")
    return JSONResponse({"status": "ok"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
