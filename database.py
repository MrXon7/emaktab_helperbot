import logging
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, BigInteger, DateTime, ForeignKey, Text, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from config import settings

logger = logging.getLogger(__name__)

# PostgreSQL ulanishi
# Agar pooler yoki direct ulanishda SSL kerak bo'lsa
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

try:
    engine = create_engine(
        db_url,
        pool_size=10,
        max_overflow=20,
        pool_recycle=300,
        pool_pre_ping=True
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    logger.info("Supabase PostgreSQL ulanishi muvaffaqiyatli o'rnatildi.")
except Exception as e:
    logger.error(f"Ma'lumotlar bazasiga ulanishda xatolik: {e}")
    raise e

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String(64), unique=True, index=True, nullable=False)
    first_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- Profil ma'lumotlari (Sinf rahbar anketasi) ---
    phone = Column(String(50), nullable=True)
    full_name = Column(String(255), nullable=True)
    school_name = Column(String(255), nullable=True)
    grade = Column(String(50), nullable=True)
    region = Column(String(100), nullable=True)
    is_registered = Column(Boolean, default=False)

    # --- Obuna (subscription) maydonlari ---
    # "trial"   → sinov rejimi (max_students bilan cheklangan, muddatsiz)
    # "active"  → to'langan, expires_at gacha
    # "blocked" → admin tomonidan bloklangan
    plan = Column(String(20), default="trial", nullable=False)
    expires_at = Column(DateTime, nullable=True)   # None = muddatsiz (trial/blocked)
    max_students = Column(Integer, default=10)     # Trial: 10, Active: sotib olingan limit

    students = relationship("Student", back_populates="owner", cascade="all, delete-orphan")

    def subscription_info(self) -> dict:
        """Obuna holatini dict sifatida qaytaradi (API va bot uchun)"""
        now = datetime.utcnow()
        days_left = None
        is_expired = False

        if self.plan == "active" and self.expires_at:
            delta = self.expires_at - now
            days_left = max(0, delta.days)
            is_expired = delta.total_seconds() <= 0

        return {
            "plan": self.plan,
            "expiresAt": self.expires_at.isoformat() if self.expires_at else None,
            "daysLeft": days_left,
            "isExpired": is_expired,
            "maxStudents": self.max_students,
        }

    def profile_dict(self) -> dict:
        return {
            "id": self.id,
            "telegram_id": self.telegram_id,
            "name": self.first_name,
            "username": self.username,
            "phone": self.phone or "",
            "fullName": self.full_name or self.first_name or "",
            "schoolName": self.school_name or "",
            "grade": self.grade or "",
            "region": self.region or "",
            "isRegistered": bool(self.is_registered),
            **self.subscription_info()
        }

class Student(Base):
    __tablename__ = "students"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    school_name = Column(String(255), default="Maktab")
    grade = Column(String(50), default="1-A")
    login = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
    parent_login = Column(String(255), nullable=True)
    parent_password = Column(String(255), nullable=True)
    status = Column(String(50), default="pending")  # 'pending', 'success', 'failed'
    message = Column(Text, default="")
    success_at = Column(BigInteger, nullable=True)  # Timestamp ms
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="students")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "schoolName": self.school_name,
            "grade": self.grade,
            "login": self.login,
            "password": self.password,
            "parentLogin": self.parent_login or "",
            "parentPassword": self.parent_password or "",
            "status": self.status,
            "message": self.message or "",
            "successAt": self.success_at
        }

class SubscriptionOrder(Base):
    __tablename__ = "subscription_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    students_count = Column(Integer, nullable=False)  # Masalan: 30
    quarters_count = Column(Integer, nullable=False)  # 1, 2, 3 yoki 4
    duration_days = Column(Integer, nullable=False)    # Masalan: 65, 130, 270 kun
    amount_uzs = Column(BigInteger, nullable=False)    # Masalan: 60000 so'm
    status = Column(String(50), default="pending")     # 'pending', 'approved', 'rejected'
    reject_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    user = relationship("User", backref="subscription_orders")

    def to_dict(self):
        user_info = {}
        if self.user:
            user_info = {
                "userName": self.user.full_name or self.user.first_name,
                "telegramId": self.user.telegram_id,
                "phone": self.user.phone or "",
                "schoolName": self.user.school_name or "",
                "grade": self.user.grade or "",
                "region": self.user.region or ""
            }

        return {
            "id": self.id,
            "userId": self.user_id,
            "studentsCount": self.students_count,
            "quartersCount": self.quarters_count,
            "durationDays": self.duration_days,
            "amountUzs": self.amount_uzs,
            "status": self.status,
            "rejectReason": self.reject_reason or "",
            "createdAt": self.created_at.strftime("%d.%m.%Y %H:%M") if self.created_at else "",
            "processedAt": self.processed_at.strftime("%d.%m.%Y %H:%M") if self.processed_at else "",
            **user_info
        }


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)

    @classmethod
    def get(cls, db, key: str, default: str = "") -> str:
        row = db.query(cls).filter(cls.key == key).first()
        return row.value if row else default

    @classmethod
    def set(cls, db, key: str, value: str):
        row = db.query(cls).filter(cls.key == key).first()
        if row:
            row.value = value
        else:
            row = cls(key=key, value=value)
            db.add(row)
        db.commit()


def _run_migrations():
    """
    Mavjud jadvalga yangi ustunlarni xavfsiz qo'shish (idempotent).
    'IF NOT EXISTS' sintaksisi yordamida bir necha marta chaqirilsa ham xatolik bermaydi.
    """
    migrations = [
        # students jadvali
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_login VARCHAR(255)",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_password VARCHAR(255)",
        # users jadvali — obuna maydonlari
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) DEFAULT 'trial'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 10",
        # users jadvali — profil maydonlari
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS school_name VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS grade VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT FALSE",
        # subscription_orders jadvali
        """
        CREATE TABLE IF NOT EXISTS subscription_orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            students_count INTEGER NOT NULL,
            quarters_count INTEGER NOT NULL,
            duration_days INTEGER NOT NULL,
            amount_uzs BIGINT NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            reject_reason VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP
        )
        """,
        # system_settings jadvali
        """
        CREATE TABLE IF NOT EXISTS system_settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    ]

    default_settings = {
        "price_per_student_quarter": "2000",
        "card_number": "9860 1234 5678 9012",
        "card_holder": "ADMIN ISM FAMILIYA",
        "admin_telegram_contact": "@emaktabro_bot"
    }

    try:
        with engine.begin() as conn:
            for stmt in migrations:
                conn.execute(text(stmt))

            # Boshlang'ich sozlamalarni kiritish (agar yo'q bo'lsa)
            for k, v in default_settings.items():
                conn.execute(text("""
                    INSERT INTO system_settings (key, value)
                    VALUES (:k, :v)
                    ON CONFLICT (key) DO NOTHING
                """), {"k": k, "v": v})

        logger.info("Barcha migratsiyalar va sozlamalar muvaffaqiyatli tekshirildi/yangilandi.")
    except Exception as e:
        logger.error(f"Migration xatosi: {e}")
        raise e

def init_db():
    """Bazada jadvallarni avtomatik yaratish va migratsiyalarni ishga tushirish"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Supabase jadvallari (users, students, subscription_orders, system_settings) tayyorlandi.")
        _run_migrations()
    except Exception as e:
        logger.error(f"Jadvallarni yaratishda yoki migratsiyada xato: {e}")
        raise e

def get_db():
    """FastAPI Request uchun DB session generatori"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

