import os
import time
import logging
import threading
import requests
from flask import Flask, jsonify

logger = logging.getLogger(__name__)

# Flask veb-serveri
flask_app = Flask(__name__)

@flask_app.route('/')
@flask_app.route('/ping')
def home():
    return jsonify({
        "status": "ok",
        "service": "eMaktab Helper Keep-Alive",
        "message": "Server faol ishlamoqda"
    })

def ping_loop():
    """
    Render serverini uxlab qolishdan saqlash uchun 
    har 5 daqiqada (300 soniya) serverga tashqi HTTP ping yuborib turadi.
    
    Alohida fondagi oqimda (Thread) ishlagani sababli asosiy FastAPI 
    va Telegram botning ishlashiga hech qanday og'irlik yoki qotish keltirib chiqarmaydi.
    """
    time.sleep(20)  # Server to'liq ishga tushib olishi uchun kutish
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    while True:
        try:
            raw_url = os.getenv("WEBAPP_URL", "https://emaktab-helperbot.onrender.com").rstrip('/')
            if raw_url and "localhost" not in raw_url and "127.0.0.1" not in raw_url:
                target_url = f"{raw_url}/health"
                resp = requests.get(target_url, headers=headers, timeout=15)
                logger.info(f"⏰ [Keep-Alive Thread] Ping muvaffaqiyatli: {target_url} (Status: {resp.status_code})")
        except Exception as e:
            logger.warning(f"⚠️ [Keep-Alive Thread] Ping xatosi: {e}")

        # Har 5 daqiqada (300 soniya) takrorlanadi
        time.sleep(300)

def keep_alive():
    """
    Asosiy keep-alive funksiyasi:
    Mustaqil fondagi oqim (daemon thread) orqali har 5 daqiqalik pingni ishga tushiradi.
    """
    ping_thread = threading.Thread(target=ping_loop, daemon=True, name="KeepAlivePingThread")
    ping_thread.start()
    logger.info("🚀 Keep-Alive fon oqimi ishga tushirildi (interval: har 5 daqiqada).")
    return ping_thread

def run_flask():
    """Flask serverini alohida ishga tushirish (agar mustaqil rejimda kerak bo'lsa)"""
    port = int(os.getenv("FLASK_PORT", 8080))
    flask_app.run(host="0.0.0.0", port=port)

if __name__ == "__main__":
    keep_alive()
    run_flask()
