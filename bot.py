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
    web_app_url = settings.WEBAPP_URL.rstrip('/')
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📱 eMaktab Helper ni ochish",
                    web_app=WebAppInfo(url=web_app_url)
                )
            ]
        ]
    )

@dp.message(CommandStart())
async def handle_start(message: types.Message):
    user_name = message.from_user.first_name if message.from_user else "Foydalanuvchi"
    welcome_text = (
        f"Assalomu alaykum, <b>{user_name}</b>!\n\n"
        "🤖 <b>eMaktab Helper</b> botiga xush kelibsiz!\n\n"
        "Ushbu bot orqali siz:\n"
        "• O'quvchilar ro'yxatini (Excel) yuklashingiz;\n"
        "• Har bir o'quvchi hisobiga avtomatik kirishni ta'minlashingiz;\n"
        "• Captcha xavfsizlik kodlarini avtomatik yechishingiz mumkin.\n\n"
        "👇 Boshlash uchun pastdagi tugmani bosing:"
    )
    await message.answer(welcome_text, reply_markup=get_main_keyboard(), parse_mode="HTML")

@dp.message(Command("help"))
async def handle_help(message: types.Message):
    help_text = (
        "💡 <b>Qanday ishlatiladi?</b>\n\n"
        "1. <b>'eMaktab Helper ni ochish'</b> tugmasini bosing;\n"
        "2. Excel (.xlsx) faylni yuklang yoki qo'lda o'quvchi kiriting;\n"
        "3. <b>'AVTOMATIK KIRISH'</b> tugmasini bosing;\n"
        "4. Tizim o'zi barcha o'quvchilarga kirib, hisobotni ko'rsatadi.\n\n"
        "<i>Shuningdek, Excel faylni to'g'ridan-to'g'ri shu botga yuborishingiz ham mumkin!</i>"
    )
    await message.answer(help_text, reply_markup=get_main_keyboard(), parse_mode="HTML")

@dp.message(F.document)
async def handle_excel_document(message: types.Message):
    doc = message.document
    if not doc.file_name.endswith(('.xlsx', '.xls')):
        await message.answer("⚠️ Iltimos, faqat <b>.xlsx</b> formatidagi Excel fayl yuboring!", parse_mode="HTML")
        return

    wait_msg = await message.answer("⏳ Excel fayl tahlil qilinmoqda...")
    
    try:
        file_obj = await bot.get_file(doc.file_id)
        file_bytes = await bot.download_file(file_obj.file_path)
        students = ExcelParser.parse_excel_bytes(file_bytes.read())

        if not students:
            await wait_msg.edit_text("❌ Fayldan o'quvchilar topilmadi. Ustunlar to'g'riligini tekshiring.")
            return

        success_text = (
            f"✅ <b>{len(students)} ta</b> o'quvchi muvaffaqiyatli aniqlandi!\n\n"
            f"📋 Jarayonni boshlash uchun Web App ni oching:"
        )
        await wait_msg.edit_text(success_text, reply_markup=get_main_keyboard(), parse_mode="HTML")

    except Exception as e:
        logger.exception(f"Fayl yuklashda xatolik: {e}")
        await wait_msg.edit_text(f"❌ Xatolik yuz berdi: {e}")
