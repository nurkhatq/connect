from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List
from database import get_db
from models.user import User, Achievement, UserAchievement
from models.test import TestResult
from routers.auth import get_current_user

router = APIRouter()

@router.get("/profile")
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user profile with statistics"""
    try:
        # Get test statistics
        test_stats = await db.execute(
            select(
                func.count(TestResult.id).label('total_tests'),
                func.avg(TestResult.percentage).label('avg_score'),
                func.max(TestResult.percentage).label('best_score'),
                func.sum(TestResult.points_earned).label('total_points')
            ).where(TestResult.user_id == current_user.id)
        )
        stats = test_stats.first()
        
        # Get recent test results
        recent_tests = await db.execute(
            select(TestResult).where(TestResult.user_id == current_user.id)
            .order_by(desc(TestResult.created_at))
            .limit(10)
        )
        recent_results = recent_tests.scalars().all()
        
        # 🔥 ИСПРАВЛЕННЫЙ запрос для достижений с explicit JOIN
        user_achievements_query = await db.execute(
            select(UserAchievement, Achievement)
            .select_from(UserAchievement)
            .join(Achievement, UserAchievement.achievement_id == Achievement.id)
            .where(UserAchievement.user_id == current_user.id)
            .order_by(desc(UserAchievement.earned_at))
        )
        
        achievements = []
        for user_achievement, achievement in user_achievements_query.all():
            achievements.append({
                "id": achievement.id,
                "title": achievement.title,
                "description": achievement.description,
                "icon": achievement.icon,
                "points": achievement.points,
                "earned_at": user_achievement.earned_at
            })
        
        return {
            "user": {
                "id": current_user.id,
                "telegram_id": current_user.telegram_id,
                "username": current_user.username,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name,
                "level": current_user.level,
                "points": current_user.points,
                "created_at": current_user.created_at,
            },
            "statistics": {
                "total_tests": stats.total_tests or 0,
                "average_score": round(stats.avg_score or 0, 1),
                "best_score": round(stats.best_score or 0, 1),
                "total_points": stats.total_points or 0,
            },
            "recent_results": [
                {
                    "id": result.id,
                    "test_id": result.test_id,
                    "percentage": result.percentage,
                    "passed": result.passed,
                    "points_earned": result.points_earned,
                    "created_at": result.created_at
                }
                for result in recent_results
            ],
            "achievements": achievements
        }
    
    except Exception as e:
        # Если ошибка с достижениями, возвращаем базовую информацию
        print(f"Error in get_user_profile: {e}")
        return {
            "user": {
                "id": current_user.id,
                "telegram_id": current_user.telegram_id,
                "username": current_user.username,
                "first_name": current_user.first_name,
                "last_name": current_user.last_name,
                "level": current_user.level,
                "points": current_user.points,
                "created_at": current_user.created_at,
            },
            "statistics": {
                "total_tests": 0,
                "average_score": 0,
                "best_score": 0,
                "total_points": 0,
            },
            "recent_results": [],
            "achievements": []
        }

@router.get("/leaderboard")
async def get_leaderboard(
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get global leaderboard"""
    try:
        # Get top users by points
        top_users = await db.execute(
            select(User).where(User.is_active == True)
            .order_by(desc(User.points))
            .limit(limit)
        )
        users = top_users.scalars().all()
        
        # Find current user rank
        user_rank_query = await db.execute(
            select(func.count(User.id)).where(
                User.points > current_user.points,
                User.is_active == True
            )
        )
        current_user_rank = user_rank_query.scalar() + 1
        
        leaderboard = []
        for index, user in enumerate(users):
            leaderboard.append({
                "rank": index + 1,
                "user_id": user.id,
                "username": user.username or f"{user.first_name} {user.last_name or ''}".strip(),
                "level": user.level,
                "points": user.points,
                "is_current_user": user.id == current_user.id
            })
        
        return {
            "leaderboard": leaderboard,
            "current_user_rank": current_user_rank,
            "total_users": len(users)
        }
    except Exception as e:
        print(f"Error in get_leaderboard: {e}")
        return {
            "leaderboard": [],
            "current_user_rank": 1,
            "total_users": 0
        }

@router.get("/achievements")
async def get_available_achievements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all available achievements"""
    try:
        # Get all achievements
        all_achievements = await db.execute(select(Achievement))
        achievements = all_achievements.scalars().all()
        
        # Get user's earned achievements
        user_achievements = await db.execute(
            select(UserAchievement.achievement_id).where(
                UserAchievement.user_id == current_user.id
            )
        )
        earned_ids = {row.achievement_id for row in user_achievements.all()}
        
        return [
            {
                "id": achievement.id,
                "title": achievement.title,
                "description": achievement.description,
                "icon": achievement.icon,
                "points": achievement.points,
                "earned": achievement.id in earned_ids
            }
            for achievement in achievements
        ]
    except Exception as e:
        print(f"Error in get_available_achievements: {e}")
        return []

@router.post("/update-profile")
async def update_user_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user profile"""
    try:
        allowed_fields = ['email', 'phone']
        
        for field, value in profile_data.items():
            if field in allowed_fields and hasattr(current_user, field):
                setattr(current_user, field, value)
        
        await db.commit()
        await db.refresh(current_user)
        
        return {"message": "Profile updated successfully"}
    except Exception as e:
        print(f"Error in update_user_profile: {e}")
        return {"message": "Error updating profile"}
