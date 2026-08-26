# 🤖 eMaktab Helper - Multi-User Telegram Mini App & Supabase PostgreSQL

Ushbu loyiha **eMaktab.uz** platformasiga o'quvchilar nomidan avtomatik kirish, faollikni ta'minlash va **Captcha** xavfsizlik kodlarini sun'iy intellekt (OCR) orqali avtomatik yechish imkonini beruvchi **Ko'p foydalanuvchili (Multi-User) Telegram Mini Web App** hisoblanadi.

Barcha ma'lumotlar **Supabase PostgreSQL** bulutli ma'lumotlar bazasida xavfsiz va doimiy saqlanadi. Har bir o'qituvchi faqat o'ziga tegishli o'quvchilarni ko'radi va boshqaradi.

---

## 🌟 Asosiy Imkoniyatlar

* 👥 **Multi-User (Ko'p foydalanuvchili) Tizim:** Har bir foydalanuvchi alohida izolyatsiyalangan hisob bilan ishlaydi. Ma'lumotlar mutlaqo aralashib ketmaydi.
* ☁️ **Supabase PostgreSQL Integratsiyasi:** Ma'lumotlar bulutda doimiy saqlanadi — Render yoki Koyeb serveri restart bo'lsa ham hech narsa o'chib ketmaydi.
* 📱 **Telegram Mini App & Dev Hybrid Auth:** Telegram ichida ochilsa haqiqiy Telegram User ID orqali, oddiy brauzerda ochilsa dev rejimi orqali ishlaydi.
* 📊 **Dashboard & Statistika:** Kutilmoqda, Muvaffaqiyatli, Xatolik hisoblagichlari va ular bo'yicha interaktiv filtrlash.
* 📁 **Excel (.xlsx) import & Namuna:** O'quvchilar ro'yxatini yuklash va tayyor namuna shablonini yuklab olish.
* ✏️ **Tahrirlash (Edit) va O'chirish:** Har bir o'quvchi ma'lumotlarini real vaqtda bazada o'zgartirish.
* ⏰ **7 Kunlik Auto-Expire:** Muvaffaqiyatli kirilgan o'quvchilar 1 haftadan so'ng avtomatik tarzda qayta "Kutilmoqda" statusiga o'tadi.
* ⚡ **Tezkor Avtomatizatsiya & Captcha Solver:** Captcha rasmlarini avtomatik aniqlash va login qilish.

---

## 📁 Loyiha Tuzilishi

```text
emaktab_web_app/
├── main.py               # FastAPI veb-server + REST API + Telegram Webhook
├── database.py           # Supabase PostgreSQL modellari (User, Student) va ulanish
├── auth.py               # Telegram InitData va Dev Hybrid autentifikatsiya
├── bot.py                # Aiogram 3 Telegram Bot mantiqi
├── emaktab_service.py    # emaktab.uz ga kirish va Captcha OCR xizmati
├── excel_parser.py       # Excel fayllarni tahlil qilish
├── config.py             # Sozlamalar va .env o'qish
├── templates/
│   └── index.html        # Telegram Mini App interfeysi (Tailwind CSS)
├── static/
│   ├── css/style.css     # Maxsus stillar va animatsiyalar
│   └── js/app.js         # Frontend mantiqi (Supabase DB bilan sinxron)
├── requirements.txt      # Kutubxonalar ro'yxati (SQLAlchemy, Psycopg2 va h.k.)
├── Procfile              # Render / Koyeb uchun ishga tushirish buyrug'i
├── Dockerfile            # Docker muhiti
└── render.yaml           # Render konfiguratsiyasi
```

---

## 🚀 1. Mahalliy (Local) Ishga Tushirish

1. Terminalda loyiha papkasiga kiring:
   ```bash
   cd d:\FlutterProjects\emaktab_helper\emaktab_web_app
   ```
2. Serverni ishga tushiring:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
3. Brauzerda `http://localhost:8000` manzilini oching.

---

## ☁️ 2. Render.com ga 100% TEKIN Deploy Qilish

1. Ushbu loyihani o'zingizning **GitHub** akkauntingizga yuklang (Push qiling).
2. [Render.com](https://render.com) ga kiring va **"New +" -> "Web Service"** ni tanlang.
3. GitHub repozitoriyangizni ulang.
4. Quyidagi parametrlarni belgilang:
   * **Runtime:** `Python 3`
   * **Build Command:** `pip install -r requirements.txt`
   * **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables** bo'limida quyidagilarni kiriting:
   * `DATABASE_URL` = `postgresql://postgres.zjuojnjmipqholkukrmh:Uzmujf20200@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
   * `BOT_TOKEN` = *Telegram bot tokeningiz (ixtiyoriy)*
   * `WEBAPP_URL` = *Render sizga bergan domen (masalan: `https://emaktab-helper.onrender.com`)*
6. **"Create Web Service"** tugmasini bosing.
