import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    WEBAPP_URL: str = os.getenv("WEBAPP_URL", "https://your-domain.koyeb.app")
    BOT_APP_URL: str = os.getenv("BOT_APP_URL", "https://t.me/emaktabro_bot/eduflowavto")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://postgres.zjuojnjmipqholkukrmh:Uzmujf20200@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    )
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-me")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")

settings = Settings()
