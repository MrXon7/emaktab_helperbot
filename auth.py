import hmac
import hashlib
import json
import logging
from datetime import datetime, timedelta
from urllib.parse import parse_qsl, unquote
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from config import settings
from database import get_db, User

logger = logging.getLogger(__name__)

def parse_and_verify_telegram_init_data(init_data_raw: str, bot_token: str) -> dict | None:
    """
    Telegram WebApp initData ni HMAC-SHA256 orqali tekshirish.
    """
    if not init_data_raw or not bot_token:
        return None

    try:
        parsed_data = dict(parse_qsl(init_data_raw, keep_blank_values=True))
        if "hash" not in parsed_data:
            return None

        received_hash = parsed_data.pop("hash")
        
        # Ma'lumotlarni alifbo bo'yicha saralash
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))

        # Secret key yasash
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        
        # Hashni hisoblash
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

        if calculated_hash == received_hash:
            if "user" in parsed_data:
                return json.loads(unquote(parsed_data["user"]))
            return parsed_data
    except Exception as e:
        logger.warning(f"Telegram initData tekshirishda xato: {e}")

    return None

async def get_current_user(
    authorization: str | None = Header(None),
    x_dev_user_id: str | None = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Multi-User Autentifikatsiyasi:
    1. Telegram initData orqali (Production)
    2. Yoki X-Dev-User-Id / Default Dev User orqali (Mahalliy sinov / Brauzer)
    """
    telegram_id = None
    first_name = "Foydalanuvchi"
    username = None

    init_data_raw = None
    if authorization and authorization.startswith("Bearer "):
        init_data_raw = authorization.replace("Bearer ", "").strip()

    # 1. Telegram tekshiruvi
    if init_data_raw and settings.BOT_TOKEN:
        user_info = parse_and_verify_telegram_init_data(init_data_raw, settings.BOT_TOKEN)
        if user_info and "id" in user_info:
            telegram_id = str(user_info["id"])
            first_name = user_info.get("first_name", "Telegram User")
            username = user_info.get("username")

    # 2. Agar Telegram tekshiruvidan o'tmagan bo'lsa (yoki Mahalliy brauzer bo'lsa)
    if not telegram_id:
        if x_dev_user_id:
            telegram_id = f"dev_{x_dev_user_id}"
            first_name = f"Test O'qituvchi ({x_dev_user_id})"
        elif init_data_raw and init_data_raw.startswith("dev_"):
            telegram_id = init_data_raw
            first_name = f"Test O'qituvchi ({init_data_raw.replace('dev_', '')})"
        else:
            # Standart mahalliy foydalanuvchi
            telegram_id = "dev_default_user"
            first_name = "Asosiy O'qituvchi (Dev)"

    # 3. Bazadan foydalanuvchini topish yoki yangi yaratish
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        now = datetime.utcnow()
        user = User(
            telegram_id=telegram_id,
            first_name=first_name,
            username=username,
            plan="trial",
            max_students=10,
            expires_at=now + timedelta(days=7)
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Yangi foydalanuvchi yaratildi: ID={user.id}, TG_ID={user.telegram_id} (7 kunlik sinov)")
    elif user.plan == "trial" and user.expires_at is None:
        created = user.created_at or datetime.utcnow()
        user.expires_at = created + timedelta(days=7)
        db.commit()

    return user


async def require_active_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Obuna holatini tekshiruvchi dependency.
    - "blocked"  → 403 xatosi
    - "trial" va 7 kun muddati o'tgan → 403 xatosi
    - "active" va muddati o'tgan → avtomatik "trial" ga qaytaradi, 403 xatosi
    """
    if user.plan == "blocked":
        raise HTTPException(
            status_code=403,
            detail="Hisobingiz bloklangan. Bot admin bilan bog'laning: @emaktabro_bot"
        )

    now = datetime.utcnow()

    # 7 kunlik sinov muddati tekshiruvi
    if user.plan == "trial":
        if user.expires_at and user.expires_at < now:
            raise HTTPException(
                status_code=403,
                detail="7 kunlik bepul sinov muddatingiz tugadi. Tizimdan to'liq foydalanish uchun obunani faollashtiring."
            )

    # Faol pullik obuna muddati tekshiruvi
    if user.plan == "active" and user.expires_at:
        if user.expires_at < now:
            user.plan = "trial"
            user.max_students = 10
            db.commit()
            raise HTTPException(
                status_code=403,
                detail="Obuna muddati tugadi. Davom etish uchun admin bilan bog'laning: @emaktabro_bot"
            )

    return user


