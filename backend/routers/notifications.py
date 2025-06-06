# Полностью замените backend/routers/notifications.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func, update
from typing import List, Optional
from datetime import datetime
from database import get_db
from models.user import User
from models.notifications import Notification
from routers.auth import get_current_user

# 🔥 ИСПРАВЛЕНО: Убираем trailing slash из всех роутов
router = APIRouter()

@router.get("")  # 🔥 БЕЗ slash!
async def get_notifications(
    limit: int = 50,
    offset: int = 0,
    type_filter: Optional[str] = None,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user notifications"""
    try:
        print(f"🔍 Getting notifications for user: {current_user.id}")
        
        query = select(Notification).where(Notification.user_id == current_user.id)
        
        if type_filter:
            query = query.where(Notification.type == type_filter)
        
        if unread_only:
            query = query.where(Notification.read == False)
        
        query = query.order_by(desc(Notification.created_at)).offset(offset).limit(limit)
        
        result = await db.execute(query)
        notifications = result.scalars().all()
        
        print(f"✅ Found {len(notifications)} notifications")
        
        response_data = []
        for notification in notifications:
            notification_data = {
                "id": str(notification.id),
                "title": notification.title,
                "message": notification.message,
                "type": notification.type,
                "read": notification.read,
                "created_at": notification.created_at.isoformat(),
                "data": notification.data or {}
            }
            response_data.append(notification_data)
        
        print(f"✅ Returning {len(response_data)} notifications")
        return response_data
        
    except Exception as e:
        print(f"❌ Error in get_notifications: {e}")
        import traceback
        traceback.print_exc()
        return []

@router.put("/{notification_id}/read")  # 🔥 БЕЗ trailing slash
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark notification as read"""
    try:
        result = await db.execute(
            select(Notification).where(
                and_(
                    Notification.id == notification_id,
                    Notification.user_id == current_user.id
                )
            )
        )
        notification = result.scalar_one_or_none()
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        notification.read = True
        await db.commit()
        
        return {"message": "Notification marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error marking notification read: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/mark-all-read")  # 🔥 БЕЗ trailing slash
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read"""
    try:
        await db.execute(
            update(Notification).where(
                and_(
                    Notification.user_id == current_user.id,
                    Notification.read == False
                )
            ).values(read=True)
        )
        await db.commit()
        
        return {"message": "All notifications marked as read"}
        
    except Exception as e:
        print(f"❌ Error marking all notifications read: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/unread-count")  # 🔥 БЕЗ trailing slash
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get unread notifications count"""
    try:
        result = await db.execute(
            select(func.count(Notification.id)).where(
                and_(
                    Notification.user_id == current_user.id,
                    Notification.read == False
                )
            )
        )
        count = result.scalar()
        
        return {"unread_count": count}
        
    except Exception as e:
        print(f"❌ Error getting unread count: {e}")
        return {"unread_count": 0}