import logging
from datetime import datetime, timedelta
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from config import settings
from database import SessionLocal, User

logger = logging.getLogger(__name__)

bot = Bot(token=settings.BOT_TOKEN) if settings.BOT_TOKEN else None
dp = Dispatcher()


def get_main_keyboard() -> InlineKeyboardMarkup:
    bot_app_url = getattr(settings, "BOT_APP_URL", "https://t.me/emaktabro_bot/eduflowavto")
    return InlineKeyboardMarkup(
        inline_keyboard=[[
            InlineKeyboardButton(text="🚀 EduFlow Avto ni ochish", url=bot_app_url)
        ]]
    )


def is_admin(user_id: int) -> bool:
    return user_id in settings.ADMIN_IDS


# ─── Barcha foydalanuvchilar uchun komandalar ────────────────────────────────

@dp.message(CommandStart())
async def handle_start(message: types.Message):
    user_name = message.from_user.first_name if message.from_user else "Foydalanuvchi"
    welcome_text = (
        f"Assalomu alaykum, <b>{user_name}</b>!\n\n"
        "🤖 <b>EduFlow Avto (eMaktab Helper)</b> botiga xush kelibsiz!\n\n"
        "Ushbu bot orqali siz:\n"
        "• O'quvchilar ro'yxatini (Excel) yuklashingiz;\n"
        "• Har bir o'quvchi hisobiga avtomatik kirishni ta'minlashingiz;\n"
        "• Captcha xavfsizlik kodlarini avtomatik yechishingiz mumkin.\n\n"
        "👇 Boshlash uchun pastdagi havola tugmasini bosing:"
    )
    await message.answer(welcome_text, reply_markup=get_main_keyboard(), parse_mode="HTML")


@dp.message(Command("help"))
async def handle_help(message: types.Message):
    help_text = (
        "💡 <b>Qanday ishlatiladi?</b>\n\n"
        "1. <b>'EduFlow Avto ni ochish'</b> tugmasini bosing;\n"
        "2. Mini App ichidagi <b>'Excel Import'</b> bo'limi orqali namunani yuklab oling yoki tayyor Excel faylni kiriting;\n"
        "3. <b>'AVTOMATIK KIRISH'</b> tugmasini bosing;\n"
        "4. Tizim avval o'quvchi, keyin ota-ona profiliga kirib, to'liq hisobotni ko'rsatadi.\n\n"
        "📦 <b>Sinov rejimi:</b> 10 ta o'quvchigacha bepul.\n"
        "✅ <b>To'liq obuna</b> uchun admin bilan bog'laning: @emaktabro_bot"
    )
    await message.answer(help_text, reply_markup=get_main_keyboard(), parse_mode="HTML")


@dp.message(Command("status"))
async def handle_status(message: types.Message):
    """Sinf rahbar o'z obuna holatini ko'radi"""
    tg_id = str(message.from_user.id)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == tg_id).first()
        if not user:
            await message.answer(
                "❌ Siz hali ro'yxatdan o'tmagansiz. Mini App ni bir marta oching.",
                reply_markup=get_main_keyboard()
            )
            return

        from sqlalchemy import func
        from database import Student
        student_count = db.query(func.count(Student.id)).filter(Student.user_id == user.id).scalar()
        sub = user.subscription_info()

        plan_emoji = {"trial": "📦", "active": "✅", "blocked": "🔴"}.get(sub["plan"], "❓")
        plan_name  = {"trial": "Sinov rejimi", "active": "Faol obuna", "blocked": "Bloklangan"}.get(sub["plan"], "Noma'lum")

        lines = [
            f"{plan_emoji} <b>Obuna holati:</b> {plan_name}",
            f"👨‍🎓 <b>O'quvchilar:</b> {student_count} / {sub['maxStudents']}",
        ]
        if sub["plan"] == "active" and sub["daysLeft"] is not None:
            lines.append(f"📅 <b>Qolgan kun:</b> {sub['daysLeft']} kun")
        elif sub["plan"] == "trial":
            lines.append("ℹ️ To'liq obuna uchun admin bilan bog'laning.")

        await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=get_main_keyboard())
    finally:
        db.close()


# ─── Faqat admin uchun komandalar ────────────────────────────────────────────

@dp.message(Command("activate"))
async def handle_activate(message: types.Message):
    """
    Foydalanuvchiga obuna berish.
    Ishlatish: /activate <telegram_id> <kun_soni> [max_o'quvchi]
    Misol:     /activate 123456789 30
               /activate 123456789 30 50
    """
    if not is_admin(message.from_user.id):
        return

    parts = message.text.split()
    if len(parts) < 3:
        await message.answer(
            "❗ Noto'g'ri format.\n"
            "Ishlatish: <code>/activate &lt;telegram_id&gt; &lt;kun&gt; [max_oquvchi]</code>\n"
            "Misol: <code>/activate 123456789 30</code>",
            parse_mode="HTML"
        )
        return

    target_tg_id = parts[1].strip()
    try:
        days = int(parts[2])
        max_s = int(parts[3]) if len(parts) >= 4 else 999
    except ValueError:
        await message.answer("❗ Kun va max_oquvchi soni butun son bo'lishi kerak.")
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == target_tg_id).first()
        if not user:
            await message.answer(f"❌ Telegram ID <code>{target_tg_id}</code> topilmadi.", parse_mode="HTML")
            return

        user.plan = "active"
        user.expires_at = datetime.utcnow() + timedelta(days=days)
        user.max_students = max_s
        db.commit()

        await message.answer(
            f"✅ <b>{user.first_name}</b> (<code>{target_tg_id}</code>) uchun obuna faollashtirildi:\n"
            f"📅 Muddat: <b>{days} kun</b> ({user.expires_at.strftime('%d.%m.%Y')} gacha)\n"
            f"👨‍🎓 Max o'quvchi: <b>{max_s} ta</b>",
            parse_mode="HTML"
        )
    finally:
        db.close()


@dp.message(Command("deactivate"))
async def handle_deactivate(message: types.Message):
    """
    Foydalanuvchini bloklash.
    Ishlatish: /deactivate <telegram_id>
    """
    if not is_admin(message.from_user.id):
        return

    parts = message.text.split()
    if len(parts) < 2:
        await message.answer(
            "❗ Ishlatish: <code>/deactivate &lt;telegram_id&gt;</code>",
            parse_mode="HTML"
        )
        return

    target_tg_id = parts[1].strip()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.telegram_id == target_tg_id).first()
        if not user:
            await message.answer(f"❌ Telegram ID <code>{target_tg_id}</code> topilmadi.", parse_mode="HTML")
            return

        user.plan = "blocked"
        user.expires_at = None
        user.max_students = 0
        db.commit()

        await message.answer(
            f"🔴 <b>{user.first_name}</b> (<code>{target_tg_id}</code>) bloklandi.",
            parse_mode="HTML"
        )
    finally:
        db.close()


@dp.message(Command("userinfo"))
async def handle_userinfo(message: types.Message):
    """
    Foydalanuvchi haqida to'liq ma'lumot.
    Ishlatish: /userinfo <telegram_id>
    """
    if not is_admin(message.from_user.id):
        return

    parts = message.text.split()
    if len(parts) < 2:
        await message.answer(
            "❗ Ishlatish: <code>/userinfo &lt;telegram_id&gt;</code>",
            parse_mode="HTML"
        )
        return

    target_tg_id = parts[1].strip()
    db = SessionLocal()
    try:
        from sqlalchemy import func
        from database import Student
        user = db.query(User).filter(User.telegram_id == target_tg_id).first()
        if not user:
            await message.answer(f"❌ Telegram ID <code>{target_tg_id}</code> topilmadi.", parse_mode="HTML")
            return

        student_count = db.query(func.count(Student.id)).filter(Student.user_id == user.id).scalar()
        sub = user.subscription_info()
        plan_name = {"trial": "Sinov", "active": "Faol", "blocked": "Bloklangan"}.get(sub["plan"], "?")

        expires_str = user.expires_at.strftime("%d.%m.%Y") if user.expires_at else "—"
        text = (
            f"👤 <b>{user.first_name}</b> (@{user.username or '—'})\n"
            f"🆔 TG ID: <code>{user.telegram_id}</code>\n"
            f"📋 Plan: <b>{plan_name}</b>\n"
            f"📅 Tugash: <b>{expires_str}</b>\n"
            f"👨‍🎓 O'quvchilar: <b>{student_count}</b> / {sub['maxStudents']}\n"
            f"📆 Qo'shilgan: {user.created_at.strftime('%d.%m.%Y') if user.created_at else '—'}"
        )
        await message.answer(text, parse_mode="HTML")
    finally:
        db.close()


@dp.message(Command("users"))
async def handle_users(message: types.Message):
    """Barcha foydalanuvchilar ro'yxati (admin uchun)"""
    if not is_admin(message.from_user.id):
        return

    db = SessionLocal()
    try:
        from sqlalchemy import func
        from database import Student
        users = db.query(User).order_by(User.created_at.desc()).limit(50).all()
        if not users:
            await message.answer("📭 Hech qanday foydalanuvchi yo'q.")
            return

        lines = ["📋 <b>Foydalanuvchilar ro'yxati:</b>\n"]
        for u in users:
            s_count = db.query(func.count(Student.id)).filter(Student.user_id == u.id).scalar()
            plan_emoji = {"trial": "📦", "active": "✅", "blocked": "🔴"}.get(u.plan, "❓")
            expires = u.expires_at.strftime("%d.%m.%Y") if u.expires_at else "—"
            lines.append(
                f"{plan_emoji} <b>{u.first_name or '—'}</b> | <code>{u.telegram_id}</code>\n"
                f"   👨‍🎓 {s_count}/{u.max_students} | 📅 {expires}"
            )

        # Telegram xabar 4096 belgidan oshmasligi uchun bo'laklash
        text = "\n".join(lines)
        if len(text) > 4000:
            text = text[:4000] + "\n...(qisqartirildi)"
        await message.answer(text, parse_mode="HTML")
    finally:
        db.close()


# ─── Excel fayllar uchun xabar ───────────────────────────────────────────────

@dp.message(F.document)
async def handle_excel_document(message: types.Message):
    info_text = (
        "⚠️ <b>Excel fayllarni bot chatiga yubormang!</b>\n\n"
        "Barcha amallar, jumladan Excel import qilish, namuna faylni yuklab olish va o'quvchilarga kirish <b>EduFlow Avto</b> Mini App ichida amalga oshiriladi.\n\n"
        "👇 Iltimos, pastdagi tugmani bosib dasturga kiring va <b>'Excel Import'</b> bo'limidan foydalaning:"
    )
    await message.answer(info_text, reply_markup=get_main_keyboard(), parse_mode="HTML")

