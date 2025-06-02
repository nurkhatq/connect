import asyncio
import logging
from config import Settings
from database import get_db
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
from telegram.constants import ParseMode
from models.user import User
from models.test import TestResult
from sqlalchemy import select, and_

# Enable logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class AITUBot:
    def __init__(self):
        self.app = Application.builder().token(Settings.telegram_bot_token).build()
        self.setup_handlers()
    
    def setup_handlers(self):
        """Setup command handlers"""
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("tests", self.tests_command))
        self.app.add_handler(CommandHandler("status", self.status_command))
        self.app.add_handler(CommandHandler("results", self.results_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        user = update.effective_user
        
        # Create inline keyboard with web app button
        keyboard = [
            [InlineKeyboardButton(
                "🚀 Open AITU Excellence Test",
                web_app={"url": f"https://{Settings.domain}"}
            )]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        welcome_text = f"""
🎓 *Welcome to AITU Excellence Test!*

Hello {user.first_name}! Ready to test your knowledge and skills?

📝 *Available Features:*
• Take practice tests in various subjects
• Submit university applications
• Track your progress and achievements
• Compete with other students

🏆 *Gamification System:*
• Earn points for completing tests
• Unlock achievements
• Climb the leaderboard
• Level up your profile

Click the button below to start your journey!
        """
        
        await update.message.reply_text(
            welcome_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    
    async def tests_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /tests command"""
        keyboard = [
            [InlineKeyboardButton(
                "📝 Take Tests",
                web_app={"url": f"https://{Settings.domain}/tests"}
            )]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        tests_text = """
📝 *Available Test Categories:*

🖥️ **ICT** - Information & Communication Technology
🧠 **Logical** - Logical Reasoning & Problem Solving
📚 **Reading** - Reading Comprehension
🇬🇧 **Use of English** - English Language Usage
📖 **Grammar** - English Grammar Rules

Each test takes about 60 minutes and consists of 20 questions.
Earn points based on your performance!
        """
        
        await update.message.reply_text(
            tests_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    
    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command"""
        user_id = update.effective_user.id
        
        async for db in get_db():
            # Get user data
            result = await db.execute(
                select(User).where(User.telegram_id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                await update.message.reply_text(
                    "Please start by opening the web app and logging in!"
                )
                break
            
            # Get recent test results
            results_query = await db.execute(
                select(TestResult).where(TestResult.user_id == user.id)
                .order_by(TestResult.created_at.desc())
                .limit(5)
            )
            recent_results = results_query.scalars().all()
            
            status_text = f"""
👤 *Your Status*

**Level:** {user.level}
**Points:** {user.points:,}
**Total Tests Taken:** {len(recent_results)}

📊 *Recent Test Results:*
            """
            
            if recent_results:
                for result in recent_results:
                    status_emoji = "✅" if result.passed else "❌"
                    status_text += f"\n{status_emoji} {result.percentage:.1f}% - {result.points_earned} points"
            else:
                status_text += "\nNo tests taken yet. Start testing to see your progress!"
            
            keyboard = [
                [InlineKeyboardButton(
                    "📊 View Full Profile",
                    web_app={"url": f"https://{Settings.domain}/profile"}
                )]
            ]
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            await update.message.reply_text(
                status_text,
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=reply_markup
            )
            break
    
    async def results_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /results command"""
        keyboard = [
            [InlineKeyboardButton(
                "📈 View Detailed Results",
                web_app={"url": f"https://{Settings.domain}/profile"}
            )]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "📈 *View your test results and progress in the web app!*\n\n"
            "See detailed analytics, compare with other students, and track your improvement over time.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    
    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        help_text = """
🤖 *AITU Excellence Test Bot Commands:*

/start - Welcome message and web app access
/tests - View available test categories
/status - Check your current level and points
/results - View your test results
/help - Show this help message

🌐 *Web App Features:*
• Interactive test taking interface
• Application submission system
• Real-time progress tracking
• Achievement system
• Leaderboard and competition

💡 *Tips:*
• Take tests regularly to improve your skills
• Review explanations after each test
• Track your progress in different subjects
• Compete with friends on the leaderboard

For technical support, contact @aitu_support
        """
        
        await update.message.reply_text(
            help_text,
            parse_mode=ParseMode.MARKDOWN
        )
    
    async def send_notification(self, user_telegram_id: int, message: str):
        """Send notification to user"""
        try:
            await self.app.bot.send_message(
                chat_id=user_telegram_id,
                text=message,
                parse_mode=ParseMode.MARKDOWN
            )
        except Exception as e:
            logger.error(f"Failed to send notification to {user_telegram_id}: {e}")
    
    async def run(self):
        """Run the bot"""
        logger.info("Starting AITU Bot...")
        await self.app.initialize()
        await self.app.start()
        await self.app.updater.start_polling()

async def main():
    bot = AITUBot()
    await bot.run()

if __name__ == "__main__":
    asyncio.run(main())
