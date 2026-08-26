import re
import io
import uuid
import json
import codecs
import logging
import httpx
from bs4 import BeautifulSoup
from PIL import Image, ImageEnhance

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# OCR Engine
try:
    import ddddocr
    _ocr_engine = ddddocr.DdddOcr(show_ad=False)
except Exception as e:
    logger.warning(f"ddddocr yuklanmadi: {e}")
    _ocr_engine = None

class EmaktabService:
    LOGIN_PAGE_URL = "https://login.emaktab.uz/"
    
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "uz,ru;q=0.9,en;q=0.8",
    }

    @classmethod
    def solve_captcha(cls, image_bytes: bytes) -> str:
        """Captcha rasmini o'qib, raqamlarini qaytaradi."""
        try:
            if _ocr_engine is not None:
                res = _ocr_engine.classification(image_bytes)
                clean_res = re.sub(r'[^0-9]', '', str(res)).strip()
                if clean_res:
                    return clean_res

            # Fallback PIL
            img = Image.open(io.BytesIO(image_bytes)).convert('L')
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(2.0)
            
            if _ocr_engine is not None:
                output = io.BytesIO()
                img.save(output, format='PNG')
                res = _ocr_engine.classification(output.getvalue())
                return re.sub(r'[^0-9]', '', str(res)).strip()

            return ""
        except Exception as e:
            logger.error(f"Captcha yechishda xatolik: {e}")
            return ""

    @classmethod
    def _is_login_successful(cls, final_url: str, html: str) -> bool:
        """Foydalanuvchi tizimga muvaffaqiyatli kirganini aniqlaydi."""
        url_lower = final_url.lower()

        # 1. Agar login.emaktab.uz dan chiqib ketgan bo'lsa (emaktab.uz/..., dnevnik.ru/...)
        if "login.emaktab.uz" not in url_lower:
            if any(domain in url_lower for domain in ["emaktab.uz", "dnevnik.ru", "schools.emaktab.uz"]):
                return True

        # 2. HTML ichidagi avtorizatsiya belgilarini tekshirish
        if 'isAuthenticated":true' in html or '"isAuthenticated": true' in html:
            return True

        if any(w in html.lower() for w in ['href="/logout"', 'href="https://login.emaktab.uz/logout"', 'class="user-menu"', 'class="profile-nav"']):
            return True

        return False

    @classmethod
    def _parse_login_response(cls, html: str) -> dict:
        """Emaktab sahifasidan xatolik va captcha talabini aniqlaydi."""
        result = {"hasErrors": False, "firstError": "", "isWrongCaptcha": False, "needsCaptcha": False}
        
        # 1. Login/Login JS JSON tekshiruvi
        for line in html.split('\n'):
            if "Login/Login" in line and "JSON.parse" in line:
                match = re.search(r"JSON\.parse\('([^']+)'\)", line)
                if match:
                    try:
                        raw = codecs.decode(match.group(1), 'unicode_escape')
                        data = json.loads(raw)
                        result["hasErrors"] = data.get("hasErrors", False)
                        result["firstError"] = data.get("firstErrorText", "") or ""
                        result["isWrongCaptcha"] = data.get("isWrongCaptcha", False)
                        result["needsCaptcha"] = data.get("exceededAttempts", False) or result["isWrongCaptcha"]
                        return result
                    except Exception as e:
                        logger.warning(f"JSON parse xatosi: {e}")

        # 2. HTML matnidan qidirish
        if "exceededattempts" in html.lower() or "captcha" in html.lower():
            result["needsCaptcha"] = True

        if "noto‘g‘ri" in html.lower() or "noto'g'ri" in html.lower():
            result["hasErrors"] = True
            result["firstError"] = "login.login.error.emailorpassword"

        return result

    @classmethod
    async def process_student_login(cls, student: dict, max_captcha_retries: int = 3) -> dict:
        student_id = student.get("id", "")
        name = student.get("name", "Noma'lum")
        login = student.get("login", "").strip()
        password = student.get("password", "").strip()

        if not login or not password:
            return {
                "id": student_id,
                "name": name,
                "status": "failed",
                "message": "Login yoki parol kiritilmagan"
            }

        async with httpx.AsyncClient(headers=cls.HEADERS, follow_redirects=True, timeout=25.0) as client:
            try:
                # 1. Boshlang'ich sahifaga kirish
                logger.info(f"[{name}] 1. Bosh sahifa ochilmoqda...")
                r_init = await client.get(cls.LOGIN_PAGE_URL)
                
                if r_init.status_code != 200:
                    return {
                        "id": student_id,
                        "name": name,
                        "status": "failed",
                        "message": f"Login sahifasi ochilmadi (Status: {r_init.status_code})"
                    }

                # Bosh sahifada Captcha kerakmi yoki yo'qligini tekshirish
                init_analysis = cls._parse_login_response(r_init.text)
                needs_captcha = init_analysis["needsCaptcha"] or "exceededAttempts\" value=\"True\"" in r_init.text

                # -------------------------------------------------------------
                # 2. AGAR CAPTCHA TALAB QILINMASA -> Dastlab Captchasiz urinib ko'ramiz
                # -------------------------------------------------------------
                if not needs_captcha:
                    logger.info(f"[{name}] 2. Captchasiz to'g'ridan-to'g'ri login urinishi...")
                    form_data = {
                        "exceededAttempts": "False",
                        "ReturnUrl": "",
                        "FingerprintId": "",
                        "login": login,
                        "password": password
                    }
                    post_headers = {
                        "Origin": "https://login.emaktab.uz",
                        "Referer": "https://login.emaktab.uz/",
                    }
                    resp = await client.post(cls.LOGIN_PAGE_URL, data=form_data, headers=post_headers)
                    final_url = str(resp.url)
                    
                    logger.info(f"[{name}] Captchasiz so'rov natijasi: {resp.status_code}, URL: {final_url}")

                    # Muvaffaqiyat tekshiruvi
                    if cls._is_login_successful(final_url, resp.text):
                        logger.info(f"[{name}] ✅ Muvaffaqiyatli kirildi! URL: {final_url}")
                        return {
                            "id": student_id,
                            "name": name,
                            "status": "success",
                            "message": "Tizimga muvaffaqiyatli kirildi"
                        }

                    # Xatolik yoki Captcha talabi chiqdimi?
                    analysis = cls._parse_login_response(resp.text)
                    if not analysis["needsCaptcha"] and analysis["firstError"] == "login.login.error.emailorpassword":
                        logger.info(f"[{name}] ❌ Login yoki parol noto'g'ri")
                        return {
                            "id": student_id,
                            "name": name,
                            "status": "failed",
                            "message": "Login yoki parol noto'g'ri"
                        }

                # -------------------------------------------------------------
                # 3. AGAR CAPTCHA CHIQSA -> Captcha bilan qayta urinishlar
                # -------------------------------------------------------------
                for attempt in range(1, max_captcha_retries + 1):
                    captcha_id = str(uuid.uuid4())
                    captcha_url = f"https://login.emaktab.uz/captcha/true/{captcha_id}"
                    
                    logger.info(f"[{name}] 3. Captcha yuklanmoqda ({attempt}-urinish): {captcha_url}")
                    c_resp = await client.get(captcha_url)
                    
                    if c_resp.status_code != 200 or len(c_resp.content) < 300:
                        logger.warning(f"[{name}] Captcha yuklanmadi, qayta urinish...")
                        continue

                    solved_code = cls.solve_captcha(c_resp.content)
                    logger.info(f"[{name}] 🧠 Yechilgan Captcha kodi: [{solved_code}]")

                    form_data = {
                        "exceededAttempts": "True",
                        "ReturnUrl": "",
                        "FingerprintId": "",
                        "login": login,
                        "password": password,
                        "Captcha.Id": captcha_id,
                        "Captcha.Input": solved_code
                    }

                    post_headers = {
                        "Origin": "https://login.emaktab.uz",
                        "Referer": "https://login.emaktab.uz/",
                    }

                    resp = await client.post(cls.LOGIN_PAGE_URL, data=form_data, headers=post_headers)
                    final_url = str(resp.url)

                    logger.info(f"[{name}] Captcha bilan so'rov natijasi: {resp.status_code}, URL: {final_url}")

                    # Muvaffaqiyat tekshiruvi
                    if cls._is_login_successful(final_url, resp.text):
                        logger.info(f"[{name}] ✅ Muvaffaqiyatli kirildi! URL: {final_url}")
                        return {
                            "id": student_id,
                            "name": name,
                            "status": "success",
                            "message": "Tizimga muvaffaqiyatli kirildi"
                        }

                    # Javob tahlili
                    analysis = cls._parse_login_response(resp.text)
                    logger.info(f"[{name}] Javob tahlili: {analysis}")

                    if analysis["isWrongCaptcha"]:
                        logger.info(f"[{name}] ⚠️ Captcha kodi xato bo'ldi, yangisi olinmoqda...")
                        continue

                    if analysis["firstError"] == "login.login.error.emailorpassword":
                        logger.info(f"[{name}] ❌ Login yoki parol noto'g'ri")
                        return {
                            "id": student_id,
                            "name": name,
                            "status": "failed",
                            "message": "Login yoki parol noto'g'ri"
                        }

                return {
                    "id": student_id,
                    "name": name,
                    "status": "failed",
                    "message": "Login yoki parol noto'g'ri (yoki Captcha urinishlari tugadi)"
                }

            except httpx.TimeoutException:
                return {
                    "id": student_id,
                    "name": name,
                    "status": "failed",
                    "message": "Ulanish vaqti tugadi (Timeout)"
                }
            except Exception as e:
                logger.exception(f"Xatolik: {e}")
                return {
                    "id": student_id,
                    "name": name,
                    "status": "failed",
                    "message": f"Texnik xatolik: {str(e)}"
                }
