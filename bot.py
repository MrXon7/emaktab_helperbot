import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from config import settings
from excel_parser import ExcelParser

logger = logging.getLogger(__name__)

bot = Bot(token=settings.BOT_TOKEN) if settings.BOT_TOKEN else None
dp = Dispatcher()

def get_main_keyboard() -> InlineKeyboardMarkup:
    bot_app_url = getattr(settings, "BOT_APP_URL", "https://t.me/emaktabro_bot/eduflowavto")
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 EduFlow Avto ni ochish",
                    url=bot_app_url
                )
            ]
        ]
    )

@dp.message(CommandStart())
async def handle_start(message: types.Message):
    user_name = message.from_user.first_name if message.from_user else "Foydalanuvchi"
    welcome_text = (
        f"Assalomu alaykum, <b>{user_name}</b>!\n\n"
        "🤖 <b>EduFlow Avto (eMaktab Helper)</b> botiga xush kelibsiz!\n\n"
        "Ushbu bot orqali siz:\n"
        "• O'quvchilar ro'yxatini (Excel) yuklashingiz;\n"
        "• Har bir o'quvchi hisobiga avtomatik kirishni ta'minlashingiz;\n"
        "• Captcha xavfsizlik kodlarini avtomatik yechishingiz mumkin.\n\n"
        "👇 Boshlash uchun pastdagi havola tugmasini bosing:"
    )
    await message.answer(welcome_text, reply_markup=get_main_keyboard(), parse_mode="HTML")

@dp.message(Command("help"))
async def handle_help(message: types.Message):
    help_text = (
        "💡 <b>Qanday ishlatiladi?</b>\n\n"
        "1. <b>'EduFlow Avto ni ochish'</b> tugmasini bosing;\n"
        "2. Mini App ichidagi <b>'Excel Import'</b> bo'limi orqali namunani yuklab oling yoki tayyor Excel faylni kiriting;\n"
        "3. <b>'AVTOMATIK KIRISH'</b> tugmasini bosing;\n"
        "4. Tizim avval o'quvchi, keyin ota-ona profiliga kirib, to'liq hisobotni ko'rsatadi."
    )
    await message.answer(help_text, reply_markup=get_main_keyboard(), parse_mode="HTML")

@dp.message(F.document)
async def handle_excel_document(message: types.Message):
    info_text = (
        "⚠️ <b>Excel fayllarni bot chatiga yubormang!</b>\n\n"
        "Barcha amallar, jumladan Excel import qilish, namuna faylni yuklab olish va o'quvchilarga kirish <b>EduFlow Avto</b> Mini App ichida amalga oshiriladi.\n\n"
        "👇 Iltimos, pastdagi tugmani bosib dasturga kiring va <b>'Excel Import'</b> bo'limidan foydalaning:"
    )
    await message.answer(info_text, reply_markup=get_main_keyboard(), parse_mode="HTML")
