import logging
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, BigInteger, DateTime, ForeignKey, Text
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

    students = relationship("Student", back_populates="owner", cascade="all, delete-orphan")

class Student(Base):
    __tablename__ = "students"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String(255), nullable=False)
    school_name = Column(String(255), default="Maktab")
    grade = Column(String(50), default="1-A")
    login = Column(String(255), nullable=False)
    password = Column(String(255), nullable=False)
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
            "status": self.status,
            "message": self.message or "",
            "successAt": self.success_at
        }

def init_db():
    """Bazada jadvallarni avtomatik yaratish"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Supabase jadvallari (users, students) tayyorlandi.")
    except Exception as e:
        logger.error(f"Jadvallarni yaratishda xato: {e}")
        raise e

def get_db():
    """FastAPI Request uchun DB session generatori"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
