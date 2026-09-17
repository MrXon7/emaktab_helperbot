import base64
import hashlib
import logging
from cryptography.fernet import Fernet, InvalidToken
from config import settings

logger = logging.getLogger(__name__)

def _get_fernet() -> Fernet:
    secret = settings.SECRET_KEY or "default-eduflow-avto-secret-2026"
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)

_fernet_instance = _get_fernet()
ENC_PREFIX = "enc:v1:"

def encrypt_value(plain_text: str | None) -> str:
    """
    Matnni (parolni) xavfsiz AES-128/Fernet orqali shifrlaydi.
    Agar bo'sh yoki allaqachon shifrlangan bo'lsa, qayta shifrlamaydi.
    """
    if not plain_text:
        return ""
    if str(plain_text).startswith(ENC_PREFIX):
        return str(plain_text)
    try:
        token = _fernet_instance.encrypt(str(plain_text).encode("utf-8")).decode("utf-8")
        return f"{ENC_PREFIX}{token}"
    except Exception as e:
        logger.error(f"Shifrlashda xatolik: {e}")
        return str(plain_text)

def decrypt_value(cipher_or_plain: str | None) -> str:
    """
    Shifrlangan parolni asliga qaytaradi.
    Agar eski (hali shifrlanmagan ochiq) parol bo'lsa, to'g'ridan-to'g'ri o'zini qaytaradi (100% orqaga mos).
    """
    if not cipher_or_plain:
        return ""
    val_str = str(cipher_or_plain)
    if not val_str.startswith(ENC_PREFIX):
        return val_str

    token = val_str[len(ENC_PREFIX):]
    try:
        decrypted_bytes = _fernet_instance.decrypt(token.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except (InvalidToken, Exception) as e:
        logger.warning(f"Shifrdan yechishda xatolik: {e}")
        return val_str
