import httpx
import uuid
import ddddocr

client = httpx.Client(follow_redirects=True, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

print("1. Boshlang'ich sahifaga kirilmoqda...")
r1 = client.get('https://login.emaktab.uz/')

captcha_uuid = str(uuid.uuid4())
captcha_url = f"https://login.emaktab.uz/captcha/true/{captcha_uuid}"

print("2. Captcha rasmi yuklanmoqda:", captcha_url)
img_resp = client.get(captcha_url)
print("Captcha status:", img_resp.status_code, "type:", img_resp.headers.get('content-type'))

ocr = ddddocr.DdddOcr(show_ad=False)
code = ocr.classification(img_resp.content)
print("OCR yechgan kod:", code)

form_data = {
    'exceededAttempts': 'True',
    'ReturnUrl': '',
    'FingerprintId': '',
    'login': 'test_student_login',
    'password': 'test_password_123',
    'Captcha.Id': captcha_uuid,
    'Captcha.Input': code
}

print("3. Form POST qilinmoqda...")
r_post = client.post('https://login.emaktab.uz/', data=form_data, headers={'Origin': 'https://login.emaktab.uz', 'Referer': 'https://login.emaktab.uz/'})
print("Post natijasi Status:", r_post.status_code, "URL:", r_post.url)

for line in r_post.text.split('\n'):
    if "firstErrorText" in line or "isWrongCaptcha" in line:
        print("Emaktab javobi:", line.strip()[:200])
