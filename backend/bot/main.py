import asyncio
import logging
import httpx
from typing import Optional
from datetime import datetime

# Импорты из вашего проекта
from config import settings
from database import get_db, SessionLocal
from models.user import User
from models.test import TestResult
from sqlalchemy import select, func, desc

# Telegram imports
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
from telegram.constants import ParseMode

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class AITUBot:
    def __init__(self):
        """Инициализация бота"""
        logger.info(f"🤖 Initializing AITU Bot...")
        self.app = Application.builder().token(settings.telegram_bot_token).build()
        self.webapp_url = f"https://{settings.domain}"
        self.chat_service_url = "http://chat-service:8000"
        self.setup_handlers()
    
    def setup_handlers(self):
        """Регистрация обработчиков команд"""
        # Основные команды
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
        
        # Команды для тестов
        self.app.add_handler(CommandHandler("tests", self.tests_command))
        self.app.add_handler(CommandHandler("status", self.status_command))
        self.app.add_handler(CommandHandler("results", self.results_command))
        
        # Команды для AI чата
        self.app.add_handler(CommandHandler("chat", self.chat_command))
        self.app.add_handler(CommandHandler("ask", self.ask_command))
        self.app.add_handler(CommandHandler("stop", self.stop_chat))
        
        # Команды для заявок
        self.app.add_handler(CommandHandler("application", self.application_command))
        
        # Обработчик callback кнопок
        self.app.add_handler(CallbackQueryHandler(self.button_callback))
        
        # Обработчик текстовых сообщений для чата
        self.app.add_handler(MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            self.handle_message
        ))
        
        logger.info("✅ Bot handlers registered")
    
    # === КОМАНДА START ===
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Главное меню бота"""
        user = update.effective_user
        logger.info(f"📱 /start from user: {user.id} (@{user.username})")
        
        # Главные кнопки
        keyboard = [
            [InlineKeyboardButton(
                "🚀 Открыть AITU Test App",
                web_app=WebAppInfo(url=self.webapp_url)
            )],
            [
                InlineKeyboardButton("📝 Пройти тесты", callback_data="menu_tests"),
                InlineKeyboardButton("🤖 AI Помощник", callback_data="menu_chat")
            ],
            [
                InlineKeyboardButton("📊 Мой прогресс", callback_data="menu_status"),
                InlineKeyboardButton("🎓 Подать заявку", callback_data="menu_application")
            ],
            [InlineKeyboardButton("❓ Помощь", callback_data="menu_help")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        welcome_text = f"""
🎓 *Добро пожаловать в AITU Bot!*

Привет, {user.first_name}! 👋

Я помогу тебе:
- 📚 Подготовиться к поступлению
- 🧠 Пройти тесты AET
- 🤖 Ответить на любые вопросы
- 📄 Подать документы

*Что такое AET?*
AITU Excellence Test - это вступительный тест для поступления в наш университет.

Выбери действие из меню ниже или используй команды.
        """
        
        await update.message.reply_text(
            welcome_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    
    # === КОМАНДЫ ДЛЯ ТЕСТОВ ===
    async def tests_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показать доступные тесты"""
        keyboard = [
            [InlineKeyboardButton(
                "📝 Открыть тесты в приложении",
                web_app=WebAppInfo(url=f"{self.webapp_url}/tests")
            )],
            [
                InlineKeyboardButton("💻 ICT", callback_data="test_info_ict"),
                InlineKeyboardButton("🧠 Logical", callback_data="test_info_logical")
            ],
            [
                InlineKeyboardButton("📖 Reading", callback_data="test_info_reading"),
                InlineKeyboardButton("🇬🇧 English", callback_data="test_info_english")
            ],
            [InlineKeyboardButton("◀️ Назад", callback_data="back_to_menu")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        tests_text = """
📝 *Доступные тесты AET:*

*Модуль 1 - Базовые навыки:*
- 💻 *ICT* - Информационные технологии
- 🧠 *Logical* - Логическое мышление

*Модуль 2 - Английский язык:*
- 📖 *Reading* - Чтение и понимание
- 🇬🇧 *Use of English* - Практика языка
- 📚 *Grammar* - Грамматика

Каждый тест:
- ⏱ 60 минут
- 📊 20 вопросов
- 🎯 Проходной балл: 70%

Нажми на кнопку теста для подробностей.
        """
        
        if update.message:
            await update.message.reply_text(
                tests_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=reply_markup
            )
        else:
            await update.callback_query.edit_message_text(
                tests_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=reply_markup
            )
    
    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показать статус пользователя"""
        user_id = update.effective_user.id
        
        try:
            async with SessionLocal() as db:
                # Получаем пользователя
                result = await db.execute(
                    select(User).where(User.telegram_id == user_id)
                )
                user = result.scalar_one_or_none()
                
                if not user:
                    await update.message.reply_text(
                        "❌ Сначала нужно зарегистрироваться!\n"
                        "Открой приложение через кнопку в /start"
                    )
                    return
                
                # Получаем статистику
                stats_result = await db.execute(
                    select(
                        func.count(TestResult.id).label('total_tests'),
                        func.avg(TestResult.percentage).label('avg_score'),
                        func.max(TestResult.percentage).label('best_score')
                    ).where(TestResult.user_id == user.id)
                )
                stats = stats_result.first()
                
                # Последние результаты
                recent_results = await db.execute(
                    select(TestResult)
                    .where(TestResult.user_id == user.id)
                    .order_by(desc(TestResult.created_at))
                    .limit(5)
                )
                recent = recent_results.scalars().all()
                
                status_text = f"""
👤 *Твой прогресс*

📊 *Статистика:*
- Уровень: {user.level} 
- Баллы: {user.points:,}
- Тестов пройдено: {stats.total_tests or 0}
- Средний балл: {stats.avg_score or 0:.1f}%
- Лучший результат: {stats.best_score or 0:.1f}%

📈 *Последние тесты:*"""
                
                if recent:
                    for r in recent:
                        emoji = "✅" if r.passed else "❌"
                        status_text += f"\n{emoji} {r.percentage:.1f}% - {r.points_earned} баллов"
                else:
                    status_text += "\nПока нет результатов"
                
                keyboard = [[
                    InlineKeyboardButton(
                        "📊 Подробная статистика",
                        web_app=WebAppInfo(url=f"{self.webapp_url}/profile")
                    )
                ]]
                
                await update.message.reply_text(
                    status_text,
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
                
        except Exception as e:
            logger.error(f"Error in status_command: {e}")
            await update.message.reply_text("❌ Произошла ошибка при получении статуса")
    
    async def results_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показать результаты тестов"""
        keyboard = [[
            InlineKeyboardButton(
                "📈 Все результаты",
                web_app=WebAppInfo(url=f"{self.webapp_url}/profile")
            )
        ]]
        
        await update.message.reply_text(
            "📊 *Твои результаты тестов*\n\n"
            "Открой приложение для просмотра детальной статистики, "
            "анализа прогресса и сравнения с другими абитуриентами.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    
    # === КОМАНДЫ ДЛЯ AI ЧАТА ===
    async def chat_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Включить режим AI чата"""
        user = update.effective_user
        logger.info(f"🤖 /chat from user: {user.id}")
        
        # Включаем режим чата
        context.user_data['chat_mode'] = True
        
        keyboard = [
            [InlineKeyboardButton("❌ Выйти из чата", callback_data="stop_chat")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        chat_text = """
🤖 *AI Помощник AITU активирован!*

Я могу ответить на вопросы о:
- 🎓 Поступлении в AITU
- 📋 Необходимых документах  
- 📝 Тестах AET
- 💰 Грантах и оплате
- 🏠 Общежитии
- 📚 Программах обучения

*Просто напиши свой вопрос!*

Примеры:
- _Какие документы нужны для поступления?_
- _Как проходит AET тест?_
- _Есть ли гранты для абитуриентов?_
- _Какой проходной балл?_

Для выхода используй /stop или кнопку ниже.
        """
        
        await update.message.reply_text(
            chat_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    
    async def ask_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Быстрый вопрос AI без режима чата"""
        if not context.args:
            examples_text = """
❓ *Как использовать команду /ask*

Формат: `/ask твой вопрос`

*Примеры:*
- `/ask Какой проходной балл в AITU?`
- `/ask Сколько стоит обучение?`
- `/ask Какие есть специальности?`
- `/ask Нужно ли сдавать ЕНТ?`
            """
            await update.message.reply_text(
                examples_text,
                parse_mode=ParseMode.MARKDOWN
            )
            return
        
        question = " ".join(context.args)
        await update.message.chat.send_action("typing")
        await self.send_to_chat_service(update, question)
    
    async def stop_chat(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Выйти из режима чата"""
        context.user_data['chat_mode'] = False
        
        keyboard = [[
            InlineKeyboardButton("🏠 Главное меню", callback_data="back_to_menu")
        ]]
        
        await update.message.reply_text(
            "🛑 *Режим чата отключен*\n\n"
            "Спасибо за использование AI помощника!\n"
            "Используй /chat чтобы начать снова.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    
    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка текстовых сообщений"""
        # Проверяем режим чата
        if not context.user_data.get('chat_mode', False):
            # Не в режиме чата - показываем подсказку
            await update.message.reply_text(
                "💡 Используй /chat для общения с AI помощником\n"
                "или /ask для быстрого вопроса"
            )
            return
        
        # В режиме чата - отправляем в AI
        await update.message.chat.send_action("typing")
        await self.send_to_chat_service(update, update.message.text)
    
    async def send_to_chat_service(self, update: Update, query: str):
        """Отправка запроса в chat service"""
        user = update.effective_user
        session_id = f"telegram_{user.id}"
        
        try:
            logger.info(f"🔄 Sending to chat service: {query[:50]}...")
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.chat_service_url}/api/student/chat",
                    json={
                        "query": query,
                        "session_id": session_id
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    answer = data.get("answer", "Не удалось получить ответ")
                    sources = data.get("sources", [])
                    
                    # Отправляем ответ
                    await self.send_formatted_answer(update, answer, sources)
                    
                else:
                    logger.error(f"Chat service error: {response.status_code}")
                    await update.message.reply_text(
                        "❌ Извините, произошла ошибка.\n"
                        "Попробуйте переформулировать вопрос."
                    )
                    
        except httpx.ConnectError:
            logger.error("Cannot connect to chat service")
            await update.message.reply_text(
                "❌ AI сервис временно недоступен.\n"
                "Попробуйте позже или используйте веб-приложение."
            )
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            await update.message.reply_text(
                "❌ Произошла ошибка. Попробуйте позже."
            )
    
    async def send_formatted_answer(self, update: Update, answer: str, sources: list):
        """Форматирование и отправка ответа"""
        # Разбиваем длинные ответы
        max_length = 3800
        
        if len(answer) <= max_length:
            # Короткий ответ
            text = f"💬 *Ответ AI:*\n\n{answer}"
            
            if sources:
                text += "\n\n📚 *Источники:*\n" + "\n".join(f"• {s}" for s in sources[:3])
            
            await update.message.reply_text(
                text,
                parse_mode=ParseMode.MARKDOWN
            )
        else:
            # Длинный ответ - разбиваем
            parts = []
            current_part = ""
            
            paragraphs = answer.split('\n\n')
            for para in paragraphs:
                if len(current_part) + len(para) > max_length:
                    parts.append(current_part)
                    current_part = para
                else:
                    current_part += "\n\n" + para if current_part else para
            
            if current_part:
                parts.append(current_part)
            
            # Отправляем части
            for i, part in enumerate(parts):
                if i == 0:
                    await update.message.reply_text(
                        f"💬 *Ответ AI:*\n\n{part}",
                        parse_mode=ParseMode.MARKDOWN
                    )
                else:
                    await update.message.reply_text(part)
            
            # Источники отдельно
            if sources:
                await update.message.reply_text(
                    "📚 *Источники:*\n" + "\n".join(f"• {s}" for s in sources[:3]),
                    parse_mode=ParseMode.MARKDOWN
                )
    
    # === КОМАНДА ДЛЯ ЗАЯВОК ===
    async def application_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Информация о подаче заявки"""
        keyboard = [
            [InlineKeyboardButton(
                "📄 Подать заявку",
                web_app=WebAppInfo(url=f"{self.webapp_url}/applications")
            )],
            [InlineKeyboardButton(
                "❓ Какие документы нужны?",
                callback_data="docs_info"
            )]
        ]
        
        application_text = """
🎓 *Подача заявки в AITU*

*Для поступления необходимо:*
1. Пройти тесты AET
2. Подготовить документы
3. Заполнить анкету
4. Дождаться рассмотрения

*Требуемые документы:*
- Удостоверение личности
- Аттестат о среднем образовании
- Сертификат ЕНТ (при наличии)
- Фото 3х4
- Медицинская справка 086-У

Используй кнопку ниже для подачи заявки онлайн.
        """
        
        await update.message.reply_text(
            application_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    
    # === КОМАНДА HELP ===
    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Справка по командам"""
        help_text = """
📚 *Помощь по командам AITU Bot*

*Основные команды:*
/start - Главное меню
/help - Эта справка

*Тестирование:*
/tests - Список доступных тестов
/status - Твой прогресс
/results - Результаты тестов

*AI Помощник:*
/chat - Включить режим диалога
/ask `вопрос` - Быстрый вопрос
/stop - Выйти из режима чата

*Поступление:*
/application - Подать заявку

*Примеры вопросов для AI:*
- Какие документы нужны?
- Как проходит AET тест?
- Есть ли гранты?
- Какой проходной балл?
- Когда начинается прием?

💡 *Совет:* В режиме /chat можно задавать уточняющие вопросы!

*Поддержка:* @aitu_support
        """
        
        await update.message.reply_text(
            help_text,
            parse_mode=ParseMode.MARKDOWN
        )
    
    # === ОБРАБОТЧИК КНОПОК ===
    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка inline кнопок"""
        query = update.callback_query
        await query.answer()
        
        # Меню навигация
        if query.data == "back_to_menu":
            # Показываем главное меню
            keyboard = [
                [InlineKeyboardButton(
                    "🚀 Открыть AITU Test App",
                    web_app=WebAppInfo(url=self.webapp_url)
                )],
                [
                    InlineKeyboardButton("📝 Пройти тесты", callback_data="menu_tests"),
                    InlineKeyboardButton("🤖 AI Помощник", callback_data="menu_chat")
                ],
                [
                    InlineKeyboardButton("📊 Мой прогресс", callback_data="menu_status"),
                    InlineKeyboardButton("🎓 Подать заявку", callback_data="menu_application")
                ],
                [InlineKeyboardButton("❓ Помощь", callback_data="menu_help")]
            ]
            
            await query.edit_message_text(
                "🏠 *Главное меню*\n\nВыберите действие:",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        
        elif query.data == "menu_tests":
            await self.tests_command(update, context)
        
        elif query.data == "menu_chat":
            context.user_data['chat_mode'] = True
            await query.edit_message_text(
                "🤖 *AI Помощник активирован!*\n\n"
                "Теперь просто напишите ваш вопрос в чат.\n"
                "Для выхода используйте /stop",
                parse_mode=ParseMode.MARKDOWN
            )
        
        elif query.data == "menu_status":
            await query.edit_message_text("Загрузка статистики...")
            # Нужно создать новое сообщение для status_command
            await self.status_command(query, context)
        
        elif query.data == "menu_application":
            keyboard = [
                [InlineKeyboardButton(
                    "📄 Подать заявку",
                    web_app=WebAppInfo(url=f"{self.webapp_url}/applications")
                )],
                [InlineKeyboardButton("◀️ Назад", callback_data="back_to_menu")]
            ]
            
            await query.edit_message_text(
                "🎓 *Подача заявки в AITU*\n\n"
                "Нажми кнопку ниже для перехода к форме заявки.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        
        elif query.data == "menu_help":
            # Показываем краткую справку с кнопкой назад
            help_text = """
📚 *Краткая справка*

- /chat - общение с AI
- /tests - доступные тесты
- /status - твой прогресс
- /application - подать заявку

Нужна подробная помощь? Используй /help
            """
            keyboard = [[InlineKeyboardButton("◀️ Назад", callback_data="back_to_menu")]]
            
            await query.edit_message_text(
                help_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
        
        elif query.data == "stop_chat":
            context.user_data['chat_mode'] = False
            await query.edit_message_text(
                "🛑 *Режим чата отключен*\n\n"
                "Спасибо за использование AI помощника!"
            )
        
        elif query.data.startswith("test_info_"):
            # Информация о конкретном тесте
            test_type = query.data.replace("test_info_", "")
            test_info = {
                "ict": ("💻 ICT", "Информационные технологии", "Базовые знания компьютера, Office, интернет"),
                "logical": ("🧠 Logical", "Логическое мышление", "Задачи на логику, последовательности, анализ"),
                "reading": ("📖 Reading", "Чтение", "Понимание текстов на английском"),
                "english": ("🇬🇧 English", "Английский язык", "Грамматика и использование языка")
            }
            
            if test_type in test_info:
                emoji, name, desc = test_info[test_type]
                keyboard = [
                    [InlineKeyboardButton(
                        "📝 Начать тест",
                        web_app=WebAppInfo(url=f"{self.webapp_url}/tests")
                    )],
                    [InlineKeyboardButton("◀️ К тестам", callback_data="menu_tests")]
                ]
                
                await query.edit_message_text(
                    f"{emoji} *{name}*\n\n{desc}\n\n"
                    f"⏱ Время: 60 минут\n"
                    f"📊 Вопросов: 20\n"
                    f"🎯 Проходной балл: 70%",
                    parse_mode=ParseMode.MARKDOWN,
                    reply_markup=InlineKeyboardMarkup(keyboard)
                )
        
        elif query.data == "docs_info":
            docs_text = """
📋 *Необходимые документы для поступления:*

1. *Удостоверение личности* (копия)
2. *Аттестат* о среднем образовании (оригинал)
3. *Сертификат ЕНТ* (если есть)
4. *Фотографии 3х4* - 6 штук
5. *Медицинская справка* форма 086-У
6. *Приписное свидетельство* (для юношей)

💡 Все документы можно загрузить через приложение!
            """
            
            keyboard = [
                [InlineKeyboardButton(
                    "📄 Загрузить документы",
                    web_app=WebAppInfo(url=f"{self.webapp_url}/applications")
                )],
                [InlineKeyboardButton("◀️ Назад", callback_data="back_to_menu")]
            ]
            
            await query.edit_message_text(
                docs_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
    
    # === ОТПРАВКА УВЕДОМЛЕНИЙ ===
    async def send_notification(self, user_telegram_id: int, message: str):
        """Отправка уведомления пользователю"""
        try:
            await self.app.bot.send_message(
                chat_id=user_telegram_id,
                text=message,
                parse_mode=ParseMode.MARKDOWN
            )
            logger.info(f"✅ Notification sent to {user_telegram_id}")
        except Exception as e:
            logger.error(f"❌ Failed to send notification: {e}")
    
    # === ЗАПУСК БОТА ===
    async def run(self):
        """Запуск бота"""
        logger.info("🚀 Starting AITU Bot...")
        try:
            await self.app.initialize()
            await self.app.start()
            await self.app.updater.start_polling(allowed_updates=Update.ALL_TYPES)
            logger.info("✅ AITU Bot is running!")
            
            # Держим бота активным
            await asyncio.Event().wait()
        except Exception as e:
            logger.error(f"❌ Bot startup failed: {e}")
            raise

async def main():
    """Главная функция"""
    try:
        bot = AITUBot()
        await bot.run()
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"❌ Critical error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())