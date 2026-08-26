import hmac
import hashlib
import json
import logging
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
        user = User(
            telegram_id=telegram_id,
            first_name=first_name,
            username=username
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Yangi foydalanuvchi yaratildi: ID={user.id}, TG_ID={user.telegram_id}")

    return user
