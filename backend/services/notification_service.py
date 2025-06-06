import asyncio
import logging
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.notifications import Notification
from config import settings

logger = logging.getLogger(__name__)

class NotificationService:
    @staticmethod
    async def create_notification(
        user_id: str,
        title: str,
        message: str,
        notification_type: str,
        data: Dict[str, Any] = None
    ) -> Notification:
        """Create a new notification and send to Telegram"""
        async for db in get_db():
            try:
                notification = Notification(
                    user_id=user_id,
                    title=title,
                    message=message,
                    type=notification_type,
                    data=data or {}
                )
                
                db.add(notification)
                await db.commit()
                await db.refresh(notification)
                
                logger.info(f"✅ Notification created: {notification.id}")
                
                # 🔥 ИСПРАВЛЕНО: Отправляем в Telegram без circular imports
                try:
                    await NotificationService._send_telegram_notification(user_id, title, message)
                except Exception as e:
                    logger.error(f"❌ Failed to send Telegram notification: {e}")
                    # Не прерываем выполнение если Telegram недоступен
                
                return notification
                
            except Exception as e:
                logger.error(f"❌ Failed to create notification: {e}")
                await db.rollback()
                raise
            finally:
                break
    
    @staticmethod
    async def _send_telegram_notification(user_id: str, title: str, message: str):
        """Send notification via Telegram (production version)"""
        try:
            # 🔥 ИСПРАВЛЕНО: Прямой импорт Telegram Bot API
            from telegram import Bot
            from telegram.constants import ParseMode
            
            # Get user's Telegram ID
            async for db in get_db():
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
                
                if user and user.telegram_id:
                    # Create bot instance
                    bot = Bot(token=settings.telegram_bot_token)
                    
                    notification_text = f"*{title}*\n\n{message}"
                    
                    await bot.send_message(
                        chat_id=user.telegram_id,
                        text=notification_text,
                        parse_mode=ParseMode.MARKDOWN
                    )
                    
                    logger.info(f"✅ Telegram notification sent to user {user.telegram_id}")
                else:
                    logger.warning(f"⚠️ User {user_id} has no Telegram ID")
                break
                
        except Exception as e:
            logger.error(f"❌ Failed to send Telegram notification: {e}")
            # В продакшене не прерываем выполнение
    
    @staticmethod
    async def notify_test_completion(user_id: str, test_title: str, score: float, passed: bool, points_earned: int):
        """Notify user about test completion"""
        try:
            status_emoji = "🎉" if passed else "📚"
            title = f"{status_emoji} Тест завершен: {test_title}"
            
            if passed:
                message = f"Поздравляем! Вы успешно прошли тест с результатом {score:.1f}% и заработали {points_earned} баллов!"
            else:
                message = f"Тест завершен с результатом {score:.1f}%. Попробуйте еще раз для улучшения результата!"
            
            await NotificationService.create_notification(
                user_id=user_id,
                title=title,
                message=message,
                notification_type="test_result",
                data={
                    "test_title": test_title,
                    "score": score,
                    "passed": passed,
                    "points_earned": points_earned
                }
            )
            
            logger.info(f"✅ Test completion notification sent for user {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send test completion notification: {e}")
    
    @staticmethod
    async def notify_application_status_change(user_id: str, application_id: str, new_status: str):
        """Notify user about application status change"""
        try:
            status_messages = {
                "reviewing": {"emoji": "🔍", "title": "Заявка на рассмотрении", "message": "Ваша заявка передана на рассмотрение приемной комиссии."},
                "approved": {"emoji": "✅", "title": "Заявка одобрена", "message": "Поздравляем! Ваша заявка была одобрена. Ожидайте дальнейших инструкций."},
                "rejected": {"emoji": "❌", "title": "Заявка отклонена", "message": "К сожалению, ваша заявка была отклонена. Вы можете подать новую заявку."},
                "accepted": {"emoji": "🎓", "title": "Вы приняты!", "message": "Поздравляем! Вы успешно приняты в AITU. Добро пожаловать!"}
            }
            
            status_info = status_messages.get(new_status, {
                "emoji": "📋",
                "title": "Статус заявки изменен",
                "message": f"Статус вашей заявки изменен на: {new_status}"
            })
            
            await NotificationService.create_notification(
                user_id=user_id,
                title=f"{status_info['emoji']} {status_info['title']}",
                message=status_info['message'],
                notification_type="application_status",
                data={
                    "application_id": application_id,
                    "status": new_status
                }
            )
            
            logger.info(f"✅ Application status notification sent for user {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send application status notification: {e}")
    
    @staticmethod
    async def notify_achievement_earned(user_id: str, achievement_title: str, achievement_points: int):
        """Notify user about new achievement"""
        try:
            await NotificationService.create_notification(
                user_id=user_id,
                title=f"🏆 Новое достижение: {achievement_title}",
                message=f"Поздравляем! Вы заработали достижение '{achievement_title}' и получили {achievement_points} баллов!",
                notification_type="achievement",
                data={
                    "achievement_title": achievement_title,
                    "points": achievement_points
                }
            )
            
            logger.info(f"✅ Achievement notification sent for user {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to send achievement notification: {e}")

# 🔥 ИСПРАВЛЕНО: Убираем Celery для продакшена, делаем простую синхронную версию
# В продакшене уведомления отправляются сразу при создании