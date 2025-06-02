import asyncio
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models.user import User
from models.notifications import Notification
from celery import Celery
from config import settings
import json

# Celery app
celery_app = Celery(
    "aitu-notifications",
    broker=settings.redis_url,
    backend=settings.redis_url
)

class NotificationService:
    @staticmethod
    async def create_notification(
        user_id: str,
        title: str,
        message: str,
        notification_type: str,
        data: Dict[str, Any] = None
    ) -> Notification:
        """Create a new notification"""
        async for db in get_db():
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
            
            # Send to Telegram bot
            send_telegram_notification.delay(user_id, title, message)
            
            return notification
    
    @staticmethod
    async def notify_test_completion(user_id: str, test_title: str, score: float, passed: bool, points_earned: int):
        """Notify user about test completion"""
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
    
    @staticmethod
    async def notify_application_status_change(user_id: str, application_id: str, new_status: str):
        """Notify user about application status change"""
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
    
    @staticmethod
    async def notify_achievement_earned(user_id: str, achievement_title: str, achievement_points: int):
        """Notify user about new achievement"""
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

@celery_app.task
def send_telegram_notification(user_id: str, title: str, message: str):
    """Send notification via Telegram bot"""
    asyncio.run(_send_telegram_notification(user_id, title, message))

async def _send_telegram_notification(user_id: str, title: str, message: str):
    """Async function to send Telegram notification"""
    try:
        from bot.main import AITUBot
        
        # Get user's Telegram ID
        async for db in get_db():
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            
            if user and user.telegram_id:
                bot = AITUBot()
                notification_text = f"*{title}*\n\n{message}"
                await bot.send_notification(user.telegram_id, notification_text)
            break
            
    except Exception as e:
        print(f"Failed to send Telegram notification: {e}")
