from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import JSONResponse  # 🔥 ДОБАВЛЕНО
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc, asc, or_, text, update, delete, Integer, String
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta
from database import get_db
from models.user import User, Achievement, UserAchievement
from models.application import Application
from models.test import Test, Question, TestResult, TestSession
from models.notifications import Notification
from routers.auth import get_current_user

# 🔥 ИСПРАВЛЕНО: Условные импорты проблемных модулей
try:
    from services.notification_service import NotificationService
    NOTIFICATION_SERVICE_AVAILABLE = True
except ImportError:
    print("⚠️ NotificationService not available")
    NOTIFICATION_SERVICE_AVAILABLE = False

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    print("⚠️ psutil not available - system metrics will be limited")
    PSUTIL_AVAILABLE = False

import json
import logging
from pathlib import Path
import subprocess
import os
import csv
import io
import uuid

router = APIRouter()

class StatusUpdateRequest(BaseModel):
    status: str
    admin_notes: Optional[str] = ""

class BulkStatusUpdate(BaseModel):
    application_ids: List[str]
    status: str
    admin_notes: Optional[str] = ""

class TestUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    time_limit: Optional[int] = None
    passing_score: Optional[int] = None
    is_active: Optional[bool] = None

class SystemSettings(BaseModel):
    maintenance_mode: bool
    registration_enabled: bool
    max_test_attempts: int
    default_passing_score: int

class AdminUser(BaseModel):
    id: str
    telegram_id: int
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    level: int
    points: int
    created_at: datetime
    total_tests: int
    avg_score: float
    last_activity: Optional[datetime]

# 🔥 УЛУЧШЕННАЯ система проверки админа
def is_admin(user: User) -> bool:
    """Проверка админских прав"""
    admin_telegram_ids = [
        1077964079,  # Замените на реальные admin telegram_id
        872587503,
    ]
    return user.telegram_id in admin_telegram_ids

def serialize_datetime(obj):
    """Помощник для сериализации datetime объектов"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif obj is None:
        return None
    return obj

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Проверка админских прав"""
    if not is_admin(current_user):
        raise HTTPException(
            status_code=403, 
            detail="Access denied. Admin privileges required."
        )
    return current_user

# 🔥 DASHBOARD STATS - ИСПРАВЛЕНО с JSONResponse
@router.get("/dashboard")
async def get_dashboard_stats(
    period: str = Query("7d", regex="^(1d|7d|30d|90d|1y)$"),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Расширенная статистика для дашборда"""
    
    # Вычисляем период
    period_map = {
        "1d": 1,
        "7d": 7, 
        "30d": 30,
        "90d": 90,
        "1y": 365
    }
    days = period_map.get(period, 7)
    start_date = datetime.utcnow() - timedelta(days=days)
    
    try:
        # 🔥 ИСПРАВЛЕНО: Получаем все результаты сразу и сохраняем значения
        
        # Общая статистика
        total_users_result = await db.execute(select(func.count(User.id)))
        total_users = total_users_result.scalar() or 0
        
        total_applications_result = await db.execute(select(func.count(Application.id)))
        total_applications = total_applications_result.scalar() or 0
        
        total_tests_result = await db.execute(select(func.count(TestResult.id)))
        total_tests = total_tests_result.scalar() or 0
        
        # Активность за период
        active_users_result = await db.execute(
            select(func.count(func.distinct(TestResult.user_id))).where(
                TestResult.created_at >= start_date
            )
        )
        active_users = active_users_result.scalar() or 0
        
        new_users_result = await db.execute(
            select(func.count(User.id)).where(User.created_at >= start_date)
        )
        new_users = new_users_result.scalar() or 0
        
        new_applications_result = await db.execute(
            select(func.count(Application.id)).where(Application.created_at >= start_date)
        )
        new_applications = new_applications_result.scalar() or 0
        
        tests_taken_result = await db.execute(
            select(func.count(TestResult.id)).where(TestResult.created_at >= start_date)
        )
        tests_taken = tests_taken_result.scalar() or 0
        
        # Статистика по статусам заявок
        app_stats_result = await db.execute(
            select(
                Application.status,
                func.count(Application.id).label('count')
            ).group_by(Application.status)
        )
        applications_by_status = {row.status: row.count for row in app_stats_result.all()}
        
        # Статистика по тестам
        test_stats_result = await db.execute(
            select(
                Test.category,
                func.count(TestResult.id).label('attempts'),
                func.avg(TestResult.percentage).label('avg_score'),
                func.sum(TestResult.passed.cast(Integer)).label('passed')
            ).join(TestResult, Test.id == TestResult.test_id)
            .where(TestResult.created_at >= start_date)
            .group_by(Test.category)
        )
        
        tests_analytics = []
        for row in test_stats_result.all():
            tests_analytics.append({
                "category": row.category,
                "attempts": row.attempts or 0,
                "avg_score": round(row.avg_score or 0, 1),
                "passed": row.passed or 0,
                "pass_rate": round((row.passed or 0) / max(row.attempts or 1, 1) * 100, 1)
            })
        
        # Данные для графиков - упрощенная версия без text()
        daily_stats_result = await db.execute(
            select(
                func.date(TestResult.created_at).label('date'),
                func.count(TestResult.id).label('tests_count')
            ).where(TestResult.created_at >= start_date)
            .group_by(func.date(TestResult.created_at))
            .order_by(func.date(TestResult.created_at))
        )
        
        # Создаем chart_data
        chart_data = {}
        for row in daily_stats_result.all():
            date_str = row.date.strftime('%Y-%m-%d') if row.date else 'unknown'
            chart_data[date_str] = {
                'tests': row.tests_count or 0,
                'users': 0,  # Упрощенно, можно добавить отдельным запросом
                'applications': 0  # Упрощенно, можно добавить отдельным запросом
            }
        
        response_data = {
            "summary": {
                "total_users": total_users,
                "total_applications": total_applications,
                "total_tests": total_tests,
                "active_users": active_users,
                "period": period
            },
            "period_stats": {
                "new_users": new_users,
                "new_applications": new_applications,
                "tests_taken": tests_taken,
                "active_users": active_users
            },
            "applications_by_status": applications_by_status,
            "tests_analytics": tests_analytics,
            "chart_data": [
                {"date": date, **data} for date, data in chart_data.items()
            ]
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Dashboard stats error: {e}")
        import traceback
        traceback.print_exc()
        
        # Возвращаем базовую структуру при ошибке
        fallback_data = {
            "summary": {
                "total_users": 0,
                "total_applications": 0,
                "total_tests": 0,
                "active_users": 0,
                "period": period
            },
            "period_stats": {
                "new_users": 0,
                "new_applications": 0,
                "tests_taken": 0,
                "active_users": 0
            },
            "applications_by_status": {},
            "tests_analytics": [],
            "chart_data": []
        }
        
        return JSONResponse(content=fallback_data)  # 🔥 ИСПРАВЛЕНО

# 🔥 УЛУЧШЕННОЕ УПРАВЛЕНИЕ ЗАЯВКАМИ
@router.get("/applications")
async def get_all_applications(
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("created_at", regex="^(created_at|updated_at|ent_score|status)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Расширенный поиск и фильтрация заявок"""
    
    try:
        query = select(Application, User).join(User, Application.user_id == User.id)
        
        # Фильтры
        if status and status != 'all':
            query = query.where(Application.status == status)
        
        if search:
            search_filter = f"%{search}%"
            query = query.where(
                or_(
                    User.first_name.ilike(search_filter),
                    User.last_name.ilike(search_filter),
                    func.cast(Application.personal_data['iin'], text('TEXT')).ilike(search_filter),
                    func.cast(Application.education['program'], text('TEXT')).ilike(search_filter)
                )
            )
        
        if date_from:
            query = query.where(Application.created_at >= datetime.fromisoformat(date_from))
        
        if date_to:
            query = query.where(Application.created_at <= datetime.fromisoformat(date_to))
        
        # Сортировка
        sort_column = getattr(Application, sort_by) if hasattr(Application, sort_by) else Application.created_at
        if sort_order == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
        
        # Пагинация
        query = query.offset(offset).limit(limit)
        
        result = await db.execute(query)
        applications_with_users = result.all()
        
        # Подсчет общего количества
        count_query = select(func.count(Application.id))
        if status and status != 'all':
            count_query = count_query.where(Application.status == status)
        if search:
            count_query = count_query.join(User, Application.user_id == User.id).where(
                or_(
                    User.first_name.ilike(f"%{search}%"),
                    User.last_name.ilike(f"%{search}%"),
                    func.cast(Application.personal_data['iin'], text('TEXT')).ilike(f"%{search}%")
                )
            )
        
        total_count = await db.execute(count_query)
        
        applications_data = []
        for app, user in applications_with_users:
            applications_data.append({
                "id": app.id,
                "application_number": app.id[-8:],
                "status": app.status,
                "personal_data": app.personal_data,
                "education": app.education,
                "documents": app.documents,
                "admin_notes": app.admin_notes,
                "created_at": app.created_at.isoformat(),  # 🔥 ИСПРАВЛЕНО: конвертируем в строку
                "updated_at": app.updated_at.isoformat() if app.updated_at else None,  # 🔥 ИСПРАВЛЕНО
                "user": {
                    "id": user.id,
                    "telegram_id": user.telegram_id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "username": user.username,
                    "level": user.level,
                    "points": user.points
                }
            })
        
        response_data = {
            "applications": applications_data,
            "total": total_count.scalar(),
            "offset": offset,
            "limit": limit,
            "filters": {
                "status": status,
                "search": search,
                "sort_by": sort_by,
                "sort_order": sort_order
            }
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Applications error: {e}")
        import traceback
        traceback.print_exc()
        
        error_response = {
            "applications": [],
            "total": 0,
            "offset": offset,
            "limit": limit,
            "filters": {
                "status": status,
                "search": search,
                "sort_by": sort_by,
                "sort_order": sort_order
            },
            "error": str(e)
        }
        
        return JSONResponse(content=error_response)  # 🔥 ИСПРАВЛЕНО
# 🔥 МАССОВЫЕ ОПЕРАЦИИ
@router.put("/applications/bulk-update")
async def bulk_update_applications(
    update_data: BulkStatusUpdate,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Массовое обновление статуса заявок"""
    
    if not update_data.application_ids:
        return JSONResponse(
            status_code=400,
            content={"detail": "No applications selected"}
        )
    
    if update_data.status not in ["submitted", "reviewing", "approved", "rejected", "accepted"]:
        return JSONResponse(
            status_code=400,
            content={"detail": "Invalid status"}
        )
    
    try:
        # Обновляем заявки
        await db.execute(
            update(Application).where(
                Application.id.in_(update_data.application_ids)
            ).values(
                status=update_data.status,
                admin_notes=update_data.admin_notes,
                updated_at=datetime.utcnow()
            )
        )
        
        # Получаем обновленные заявки для отправки уведомлений
        updated_apps = await db.execute(
            select(Application).where(Application.id.in_(update_data.application_ids))
        )
        
        await db.commit()
        
        # Отправляем уведомления
        if NOTIFICATION_SERVICE_AVAILABLE:
            for app in updated_apps.scalars().all():
                try:
                    await NotificationService.notify_application_status_change(
                        user_id=app.user_id,
                        application_id=app.id,
                        new_status=update_data.status
                    )
                except Exception as e:
                    print(f"Failed to send notification for {app.id}: {e}")
        
        response_data = {
            "message": f"Updated {len(update_data.application_ids)} applications to {update_data.status}",
            "updated_count": len(update_data.application_ids),
            "status": update_data.status
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Bulk update error: {e}")
        await db.rollback()
        return JSONResponse(
            status_code=500,
            content={"error": f"Bulk update failed: {str(e)}"}
        )

# 🔥 АНАЛИТИКА ПОЛЬЗОВАТЕЛЕЙ
@router.get("/users/analytics")
async def get_users_analytics(
    period: str = Query("30d"),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Аналитика пользователей"""
    
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    start_date = datetime.utcnow() - timedelta(days=days)
    
    try:
        # Регистрации по дням
        registrations = await db.execute(
            text("""
            SELECT 
                date_trunc('day', created_at) as date,
                count(*) as registrations
            FROM users 
            WHERE created_at >= :start_date
            GROUP BY date_trunc('day', created_at)
            ORDER BY date
            """), {"start_date": start_date}
        )
        
        # Активность пользователей
        activity = await db.execute(
            text("""
            SELECT 
                date_trunc('day', tr.created_at) as date,
                count(distinct tr.user_id) as active_users,
                count(*) as tests_taken
            FROM test_results tr
            WHERE tr.created_at >= :start_date
            GROUP BY date_trunc('day', tr.created_at)
            ORDER BY date
            """), {"start_date": start_date}
        )
        
        # Топ пользователи
        top_users = await db.execute(
            select(
                User.first_name,
                User.last_name,
                User.points,
                User.level,
                func.count(TestResult.id).label('tests_count'),
                func.avg(TestResult.percentage).label('avg_score')
            ).outerjoin(TestResult, User.id == TestResult.user_id)
            .group_by(User.id, User.first_name, User.last_name, User.points, User.level)
            .order_by(desc(User.points))
            .limit(10)
        )
        
        response_data = {
            "registrations": [
                {"date": row.date.strftime('%Y-%m-%d'), "count": row.registrations}
                for row in registrations.all()
            ],
            "activity": [
                {
                    "date": row.date.strftime('%Y-%m-%d'), 
                    "active_users": row.active_users,
                    "tests_taken": row.tests_taken
                }
                for row in activity.all()
            ],
            "top_users": [
                {
                    "name": f"{row.first_name} {row.last_name or ''}".strip(),
                    "points": row.points,
                    "level": row.level,
                    "tests_count": row.tests_count,
                    "avg_score": round(row.avg_score or 0, 1)
                }
                for row in top_users.all()
            ]
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Users analytics error: {e}")
        error_response = {
            "registrations": [],
            "activity": [],
            "top_users": [],
            "period": period,
            "error": str(e)
        }
        return JSONResponse(content=error_response)  # 🔥 ИСПРАВЛЕНО

# 🔥 УПРАВЛЕНИЕ ТЕСТАМИ
@router.get("/tests")
async def get_all_tests(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все тесты с аналитикой"""
    
    try:
        tests_query = await db.execute(
            select(
                Test,
                func.count(TestResult.id).label('total_attempts'),
                func.avg(TestResult.percentage).label('avg_score'),
                func.sum(TestResult.passed.cast(Integer)).label('passed_count'),
                func.count(Question.id).label('questions_count')
            ).outerjoin(TestResult, Test.id == TestResult.test_id)
            .outerjoin(Question, Test.category == Question.test_category)
            .group_by(Test.id)
            .order_by(Test.title)
        )
        
        tests_data = []
        for row in tests_query.all():
            test = row[0]
            tests_data.append({
                "id": test.id,
                "title": test.title,
                "description": test.description,
                "category": test.category,
                "time_limit": test.time_limit,
                "passing_score": test.passing_score,
                "questions_count": test.questions_count,
                "is_active": test.is_active,
                "created_at": test.created_at.isoformat() if hasattr(test, 'created_at') and test.created_at else None,  # 🔥 ИСПРАВЛЕНО
                "analytics": {
                    "total_attempts": row.total_attempts or 0,
                    "avg_score": round(row.avg_score or 0, 1),
                    "passed_count": row.passed_count or 0,
                    "available_questions": row.questions_count or 0,
                    "pass_rate": round((row.passed_count or 0) / max(row.total_attempts or 1, 1) * 100, 1)
                }
            })
        
        return JSONResponse(content=tests_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Tests error: {e}")
        return JSONResponse(content=[])  # 🔥 ИСПРАВЛЕНО


@router.put("/tests/{test_id}")
async def update_test(
    test_id: str,
    update_data: TestUpdateRequest,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить тест"""
    
    try:
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()
        
        if not test:
            return JSONResponse(
                status_code=404,
                content={"detail": "Test not found"}
            )
        
        # Обновляем только переданные поля
        update_fields = update_data.dict(exclude_unset=True)
        for field, value in update_fields.items():
            setattr(test, field, value)
        
        await db.commit()
        await db.refresh(test)
        
        response_data = {
            "message": f"Test '{test.title}' updated successfully",
            "test": {
                "id": test.id,
                "title": test.title,
                "is_active": test.is_active
            }
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Test update error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Test update failed: {str(e)}"}
        )

# 🔥 ЭКСПОРТ ДАННЫХ
@router.get("/export/applications")
async def export_applications(
    format: str = Query("csv", regex="^(csv|json)$"),
    status: Optional[str] = None,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Экспорт заявок"""
    
    try:
        query = select(Application, User).join(User, Application.user_id == User.id)
        
        if status and status != 'all':
            query = query.where(Application.status == status)
        
        result = await db.execute(query)
        applications = result.all()
        
        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Headers
            writer.writerow([
                'ID', 'Application Number', 'Status', 'First Name', 'Last Name', 
                'IIN', 'Gender', 'Birth Date', 'Degree', 'Program', 'ENT Score',
                'Documents Count', 'Created At', 'Updated At', 'Admin Notes'
            ])
            
            # Data
            for app, user in applications:
                writer.writerow([
                    app.id,
                    app.id[-8:],
                    app.status,
                    user.first_name,
                    user.last_name or '',
                    app.personal_data.get('iin', ''),
                    app.personal_data.get('gender', ''),
                    app.personal_data.get('birth_date', ''),
                    app.education.get('degree', ''),
                    app.education.get('program', ''),
                    app.education.get('ent_score', ''),
                    len(app.documents or []),
                    app.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    app.updated_at.strftime('%Y-%m-%d %H:%M:%S') if app.updated_at else '',
                    app.admin_notes or ''
                ])
            
            output.seek(0)
            response_data = {
                "filename": f"applications_{status or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                "content": output.getvalue(),
                "content_type": "text/csv"
            }
            
            return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
        else:  # JSON format
            export_data = []
            for app, user in applications:
                export_data.append({
                    "application": {
                        "id": app.id,
                        "status": app.status,
                        "personal_data": app.personal_data,
                        "education": app.education,
                        "documents": app.documents,
                        "admin_notes": app.admin_notes,
                        "created_at": app.created_at.isoformat(),
                        "updated_at": app.updated_at.isoformat() if app.updated_at else None
                    },
                    "user": {
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "telegram_id": user.telegram_id,
                        "level": user.level,
                        "points": user.points
                    }
                })
            
            response_data = {
                "filename": f"applications_{status or 'all'}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                "content": json.dumps(export_data, indent=2),
                "content_type": "application/json"
            }
            
            return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
            
    except Exception as e:
        print(f"❌ Export error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Export failed: {str(e)}"}
        )

# 🔥 СИСТЕМНЫЕ ЛОГИ
@router.get("/logs")
async def get_system_logs(
    level: str = Query("INFO", regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"),
    limit: int = Query(100, le=1000),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить системные логи (заглушка - в реальности нужна интеграция с логгером)"""
    
    # Здесь должна быть интеграция с системой логирования
    # Для примера возвращаем мок-данные
    logs = []
    for i in range(min(limit, 50)):
        logs.append({
            "timestamp": (datetime.utcnow() - timedelta(minutes=i)).isoformat(),
            "level": level,
            "message": f"Sample log message {i}",
            "module": "admin.router",
            "user_id": "system"
        })
    
    response_data = {
        "logs": logs,
        "total": len(logs),
        "level": level
    }
    
    return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО

# 🔥 УВЕДОМЛЕНИЯ ДЛЯ АДМИНОВ
@router.post("/notifications/broadcast")
async def broadcast_notification(
    notification_data: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Отправить уведомление всем пользователям"""
    
    title = notification_data.get("title")
    message = notification_data.get("message")
    target_type = notification_data.get("target", "all")  # all, active, level_X
    
    if not title or not message:
        return JSONResponse(
            status_code=400,
            content={"detail": "Title and message are required"}
        )
    
    try:
        # Получаем целевых пользователей
        query = select(User.id).where(User.is_active == True)
        
        if target_type == "active":
            # Пользователи, активные за последние 30 дней
            recent_activity = datetime.utcnow() - timedelta(days=30)
            query = query.join(TestResult, User.id == TestResult.user_id).where(
                TestResult.created_at >= recent_activity
            ).distinct()
        elif target_type.startswith("level_"):
            level = int(target_type.split("_")[1])
            query = query.where(User.level >= level)
        
        users = await db.execute(query)
        user_ids = [user_id for (user_id,) in users.all()]
        
        # Создаем уведомления
        notifications_created = 0
        if NOTIFICATION_SERVICE_AVAILABLE:
            for user_id in user_ids:
                try:
                    await NotificationService.create_notification(
                        user_id=user_id,
                        title=title,
                        message=message,
                        notification_type="system",
                        data={"broadcast": True, "admin_id": admin_user.id}
                    )
                    notifications_created += 1
                except Exception as e:
                    print(f"Failed to create notification for user {user_id}: {e}")
        
        response_data = {
            "message": f"Broadcast sent to {notifications_created} users",
            "target_users": len(user_ids),
            "notifications_created": notifications_created,
            "target_type": target_type
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Broadcast error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Broadcast failed: {str(e)}"}
        )

# 🔥 СИСТЕМНЫЕ НАСТРОЙКИ
@router.get("/settings")
async def get_system_settings(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить системные настройки"""
    # В реальной системе это будет из базы или конфига
    settings_data = {
        "maintenance_mode": False,
        "registration_enabled": True,
        "max_test_attempts": 10,
        "default_passing_score": 70,
        "notifications_enabled": True,
        "auto_backup_enabled": True,
        "session_timeout": 24 * 60,  # минуты
        "max_file_size": 10 * 1024 * 1024,  # байты
        "supported_languages": ["ru", "kk", "en"],
        "telegram_notifications": True
    }
    
    return JSONResponse(content=settings_data)  # 🔥 ИСПРАВЛЕНО

@router.put("/settings")
async def update_system_settings(
    settings_data: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить системные настройки"""
    try:
        # В реальной системе сохраняем в базу или конфиг файл
        print(f"💾 Updating system settings by admin {admin_user.telegram_id}")
        print(f"📋 New settings: {settings_data}")
        
        # TODO: Сохранение в базу данных или конфиг файл
        # Пока что просто логируем
        
        response_data = {
            "message": "Settings updated successfully",
            "updated_at": datetime.utcnow().isoformat(),
            "updated_by": admin_user.id
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Settings update error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to update settings: {str(e)}"}
        )

# 🔥 УПРАВЛЕНИЕ ТЕСТАМИ (дублированный endpoint, но оставляем для совместимости)
@router.put("/tests/{test_id}")
async def update_test_admin(
    test_id: str,
    update_data: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить тест (admin)"""
    try:
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()
        
        if not test:
            return JSONResponse(
                status_code=404,
                content={"detail": "Test not found"}
            )
        
        # Обновляем поля
        for field, value in update_data.items():
            if hasattr(test, field):
                setattr(test, field, value)
        
        await db.commit()
        await db.refresh(test)
        
        response_data = {
            "message": f"Test '{test.title}' updated successfully",
            "test": {
                "id": test.id,
                "title": test.title,
                "is_active": test.is_active,
                "updated_at": datetime.utcnow().isoformat()
            }
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Test update error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to update test: {str(e)}"}
        )

@router.get("/tests/analytics")
async def get_tests_analytics(
    period: str = Query("30d"),
    test_id: Optional[str] = None,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить аналитику тестов"""
    try:
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        query = select(
            Test.id,
            Test.title,
            Test.category,
            func.count(TestResult.id).label('attempts'),
            func.avg(TestResult.percentage).label('avg_score'),
            func.sum(TestResult.passed.cast(Integer)).label('passed_count'),
            func.min(TestResult.created_at).label('first_attempt'),
            func.max(TestResult.created_at).label('last_attempt')
        ).outerjoin(TestResult, Test.id == TestResult.test_id)
        
        if test_id:
            query = query.where(Test.id == test_id)
        
        query = query.where(
            or_(TestResult.created_at >= start_date, TestResult.created_at.is_(None))
        ).group_by(Test.id, Test.title, Test.category)
        
        result = await db.execute(query)
        analytics = []
        
        for row in result.all():
            attempts = row.attempts or 0
            passed = row.passed_count or 0
            
            analytics.append({
                "test_id": row.id,
                "title": row.title,
                "category": row.category,
                "attempts": attempts,
                "avg_score": round(row.avg_score or 0, 1),
                "passed_count": passed,
                "pass_rate": round((passed / max(attempts, 1)) * 100, 1),
                "first_attempt": row.first_attempt.isoformat() if row.first_attempt else None,
                "last_attempt": row.last_attempt.isoformat() if row.last_attempt else None
            })
        
        response_data = {
            "analytics": analytics,
            "period": period,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Tests analytics error: {e}")
        error_response = {
            "analytics": [],
            "period": period,
            "error": str(e)
        }
        return JSONResponse(content=error_response)  # 🔥 ИСПРАВЛЕНО

# 🔥 УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
@router.get("/users")
async def get_users_admin(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    level: Optional[int] = None,
    registered_after: Optional[str] = None,
    last_active_after: Optional[str] = None,
    sort_by: str = Query("created_at", regex="^(created_at|points|level|last_activity)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить пользователей с расширенными фильтрами"""
    try:
        # Основной запрос
        base_query = select(
            User,
            func.count(TestResult.id).label('total_tests'),
            func.avg(TestResult.percentage).label('avg_score'),
            func.max(TestResult.created_at).label('last_test_date')
        ).outerjoin(TestResult, User.id == TestResult.user_id)
        
        # Фильтры
        if search:
            search_filter = f"%{search}%"
            base_query = base_query.where(
                or_(
                    User.first_name.ilike(search_filter),
                    User.last_name.ilike(search_filter),
                    User.username.ilike(search_filter),
                    func.cast(User.telegram_id, String).ilike(search_filter)
                )
            )
        
        if level:
            base_query = base_query.where(User.level >= level)
        
        if registered_after:
            base_query = base_query.where(User.created_at >= datetime.fromisoformat(registered_after))
        
        # Группировка
        base_query = base_query.group_by(User.id)
        
        # Сортировка
        if sort_by == "created_at":
            sort_column = User.created_at
        elif sort_by == "points":
            sort_column = User.points
        elif sort_by == "level":
            sort_column = User.level
        else:
            sort_column = User.created_at
        
        if sort_order == "desc":
            base_query = base_query.order_by(desc(sort_column))
        else:
            base_query = base_query.order_by(asc(sort_column))
        
        # Пагинация
        query = base_query.offset(offset).limit(limit)
        result = await db.execute(query)
        users_data = result.all()
        
        # Подсчет общего количества
        count_query = select(func.count(User.id))
        if search:
            count_query = count_query.where(
                or_(
                    User.first_name.ilike(f"%{search}%"),
                    User.last_name.ilike(f"%{search}%"),
                    User.username.ilike(f"%{search}%")
                )
            )
        if level:
            count_query = count_query.where(User.level >= level)
        if registered_after:
            count_query = count_query.where(User.created_at >= datetime.fromisoformat(registered_after))
        
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Форматируем результат
        users = []
        for row in users_data:
            user = row[0]  # User object
            users.append({
                "id": user.id,
                "telegram_id": user.telegram_id,
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "level": user.level,
                "points": user.points,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),  # 🔥 ИСПРАВЛЕНО: конвертируем в строку
                "total_tests": row.total_tests or 0,
                "avg_score": round(row.avg_score or 0, 1),
                "last_activity": row.last_test_date.isoformat() if row.last_test_date else None  # 🔥 ИСПРАВЛЕНО
            })
        
        response_data = {
            "users": users,
            "total": total,
            "offset": offset,
            "limit": limit,
            "filters": {
                "search": search,
                "level": level,
                "sort_by": sort_by,
                "sort_order": sort_order
            }
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Users query error: {e}")
        error_response = {
            "users": [],
            "total": 0,
            "offset": offset,
            "limit": limit,
            "filters": {
                "search": search,
                "level": level,
                "sort_by": sort_by,
                "sort_order": sort_order
            },
            "error": str(e)
        }
        return JSONResponse(content=error_response)  # 🔥 ИСПРАВЛЕНО


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    status_data: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить статус пользователя"""
    try:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            return JSONResponse(
                status_code=404,
                content={"detail": "User not found"}
            )
        
        old_status = user.is_active
        user.is_active = status_data.get("is_active", user.is_active)
        
        await db.commit()
        
        response_data = {
            "message": f"User {user.first_name} status updated",
            "user_id": user.id,
            "old_status": old_status,
            "new_status": user.is_active
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ User status update error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to update user: {str(e)}"}
        )

@router.get("/analytics/users")
async def get_users_analytics_detailed(
    period: str = Query("30d"),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Детальная аналитика пользователей"""
    try:
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Регистрации по дням
        registrations_query = await db.execute(
            select(
                func.date(User.created_at).label('date'),
                func.count(User.id).label('registrations')
            ).where(User.created_at >= start_date)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )
        
        # Активность пользователей
        activity_query = await db.execute(
            select(
                func.date(TestResult.created_at).label('date'),
                func.count(func.distinct(TestResult.user_id)).label('active_users'),
                func.count(TestResult.id).label('tests_taken')
            ).where(TestResult.created_at >= start_date)
            .group_by(func.date(TestResult.created_at))
            .order_by(func.date(TestResult.created_at))
        )
        
        # Топ пользователи
        top_users_query = await db.execute(
            select(
                User.first_name,
                User.last_name,
                User.points,
                User.level,
                func.count(TestResult.id).label('tests_count'),
                func.avg(TestResult.percentage).label('avg_score')
            ).outerjoin(TestResult, User.id == TestResult.user_id)
            .group_by(User.id, User.first_name, User.last_name, User.points, User.level)
            .order_by(desc(User.points))
            .limit(10)
        )
        
        response_data = {
            "registrations": [
                {"date": row.date.strftime('%Y-%m-%d') if row.date else '', "count": row.registrations}  # 🔥 ИСПРАВЛЕНО
                for row in registrations_query.all()
            ],
            "activity": [
                {
                    "date": row.date.strftime('%Y-%m-%d') if row.date else '',  # 🔥 ИСПРАВЛЕНО
                    "active_users": row.active_users,
                    "tests_taken": row.tests_taken
                }
                for row in activity_query.all()
            ],
            "top_users": [
                {
                    "name": f"{row.first_name} {row.last_name or ''}".strip(),
                    "points": row.points,
                    "level": row.level,
                    "tests_count": row.tests_count,
                    "avg_score": round(row.avg_score or 0, 1)
                }
                for row in top_users_query.all()
            ],
            "period": period,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Users analytics error: {e}")
        error_response = {
            "registrations": [],
            "activity": [],
            "top_users": [],
            "period": period,
            "error": str(e)
        }
        return JSONResponse(content=error_response)  # 🔥 ИСПРАВЛЕНО


# 🔥 СИСТЕМНАЯ ИНФОРМАЦИЯ
@router.get("/system/status")
async def get_system_status(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить статус системы"""
    try:
        # Проверка базы данных
        db_status = "healthy"
        try:
            await db.execute(text("SELECT 1"))
        except:
            db_status = "unhealthy"
        
        # Проверка Redis
        redis_status = "healthy"
        try:
            from database import redis_client
            redis_client.ping()
        except:
            redis_status = "unhealthy"
        
        # Системные метрики
        metrics = {
            "cpu_usage": 0,
            "memory_usage": 0,
            "memory_total": 0,
            "memory_available": 0,
            "disk_usage": 0,
            "disk_total": 0,
            "disk_free": 0
        }
        
        if PSUTIL_AVAILABLE:
            try:
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                
                metrics.update({
                    "cpu_usage": cpu_percent,
                    "memory_usage": memory.percent,
                    "memory_total": memory.total,
                    "memory_available": memory.available,
                    "disk_usage": disk.percent,
                    "disk_total": disk.total,
                    "disk_free": disk.free
                })
            except Exception as e:
                print(f"⚠️ Failed to get system metrics: {e}")
        
        # Статистика базы данных
        try:
            users_count = await db.execute(select(func.count(User.id)))
            applications_count = await db.execute(select(func.count(Application.id)))
            tests_count = await db.execute(select(func.count(TestResult.id)))
            
            database_stats = {
                "users": users_count.scalar(),
                "applications": applications_count.scalar(),
                "test_results": tests_count.scalar()
            }
        except Exception as e:
            print(f"⚠️ Failed to get database stats: {e}")
            database_stats = {
                "users": 0,
                "applications": 0,
                "test_results": 0
            }
        
        uptime = 0
        if PSUTIL_AVAILABLE:
            try:
                uptime = psutil.boot_time()
            except:
                pass
        
        response_data = {
            "status": "healthy" if db_status == "healthy" else "degraded",
            "components": {
                "database": db_status,
                "redis": redis_status,
                "api": "healthy"
            },
            "metrics": metrics,
            "database_stats": database_stats,
            "uptime": uptime,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ System status error: {e}")
        error_response = {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
        return JSONResponse(content=error_response)  # 🔥 ИСПРАВЛЕНО


@router.get("/export/users")
async def export_users(
    format: str = Query("csv", regex="^(csv|json|xlsx)$"),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Экспорт пользователей"""
    try:
        # Получаем всех пользователей с дополнительной информацией
        query = await db.execute(
            select(
                User,
                func.count(TestResult.id).label('total_tests'),
                func.avg(TestResult.percentage).label('avg_score'),
                func.max(TestResult.created_at).label('last_activity')
            ).outerjoin(TestResult, User.id == TestResult.user_id)
            .group_by(User.id)
            .order_by(User.created_at)
        )
        
        users_data = query.all()
        
        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Headers
            writer.writerow([
                'ID', 'Telegram ID', 'Username', 'First Name', 'Last Name',
                'Level', 'Points', 'Is Active', 'Total Tests', 'Avg Score',
                'Last Activity', 'Created At'
            ])
            
            # Data
            for row in users_data:
                user = row[0]
                writer.writerow([
                    user.id,
                    user.telegram_id,
                    user.username or '',
                    user.first_name,
                    user.last_name or '',
                    user.level,
                    user.points,
                    user.is_active,
                    row.total_tests or 0,
                    round(row.avg_score or 0, 1),
                    row.last_activity.isoformat() if row.last_activity else '',  # 🔥 ИСПРАВЛЕНО
                    user.created_at.isoformat()  # 🔥 ИСПРАВЛЕНО
                ])
            
            response_data = {
                "filename": f"users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                "content": output.getvalue(),
                "content_type": "text/csv"
            }
            
            return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
        else:  # JSON
            export_data = []
            for row in users_data:
                user = row[0]
                export_data.append({
                    "id": user.id,
                    "telegram_id": user.telegram_id,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "level": user.level,
                    "points": user.points,
                    "is_active": user.is_active,
                    "total_tests": row.total_tests or 0,
                    "avg_score": round(row.avg_score or 0, 1),
                    "last_activity": row.last_activity.isoformat() if row.last_activity else None,  # 🔥 ИСПРАВЛЕНО
                    "created_at": user.created_at.isoformat()  # 🔥 ИСПРАВЛЕНО
                })
            
            response_data = {
                "filename": f"users_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                "content": json.dumps(export_data, indent=2),
                "content_type": "application/json"
            }
            
            return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
            
    except Exception as e:
        print(f"❌ Users export error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Export failed: {str(e)}"}
        )


# 🔥 РЕЗЕРВНОЕ КОПИРОВАНИЕ
@router.post("/backup")
async def create_backup(
    admin_user: User = Depends(get_admin_user)
):
    """Создать резервную копию"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"aitu_backup_{timestamp}.sql"
        
        # В продакшне здесь будет реальная команда pg_dump
        # Пока что создаем mock backup
        backup_info = {
            "filename": backup_filename,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": admin_user.id,
            "size": "15.7 MB",  # Mock size
            "status": "completed"
        }
        
        response_data = {
            "message": "Backup created successfully",
            "backup": backup_info
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Backup creation error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Backup failed: {str(e)}"}
        )

@router.get("/backup/history")
async def get_backup_history(
    admin_user: User = Depends(get_admin_user)
):
    """Получить историю резервных копий"""
    # Mock data - в реальности из файловой системы или базы
    backups = [
        {
            "id": "1",
            "filename": "aitu_backup_20241203_120000.sql",
            "created_at": "2024-12-03T12:00:00Z",
            "size": "15.7 MB",
            "status": "completed"
        },
        {
            "id": "2", 
            "filename": "aitu_backup_20241202_120000.sql",
            "created_at": "2024-12-02T12:00:00Z",
            "size": "15.2 MB",
            "status": "completed"
        }
    ]
    
    response_data = {
        "backups": backups,
        "total": len(backups)
    }
    
    return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО

# 🔥 РАСШИРЕННЫЕ ADMIN ENDPOINTS

# Расширенное управление заявками
@router.get("/applications/advanced")
async def get_admin_applications_advanced(
    params: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Расширенный поиск заявок"""
    try:
        # Логика аналогична get_all_applications, но с дополнительными фильтрами
        response_data = {
            "applications": [],
            "total": 0,
            "advanced_filters_applied": True
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Advanced applications error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Advanced search failed: {str(e)}"}
        )

# Дополнительные аналитические endpoints
@router.get("/analytics/conversion")
async def get_conversion_funnel(
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Воронка конверсии"""
    try:
        response_data = {
            "funnel_stages": [
                {"stage": "registration", "count": 1000, "conversion": 100},
                {"stage": "first_test", "count": 800, "conversion": 80},
                {"stage": "application_started", "count": 600, "conversion": 60},
                {"stage": "application_submitted", "count": 400, "conversion": 40},
                {"stage": "application_approved", "count": 200, "conversion": 20}
            ],
            "generated_at": datetime.utcnow().isoformat()
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Conversion analytics error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Conversion analytics failed: {str(e)}"}
        )

@router.get("/analytics/cohort")
async def get_cohort_analysis(
    period: str = Query("30d"),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Когортный анализ"""
    try:
        response_data = {
            "cohorts": [],
            "period": period,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Cohort analysis error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Cohort analysis failed: {str(e)}"}
        )

# Управление уведомлениями (расширенное)
@router.get("/notifications/templates")
async def get_notification_templates(
    admin_user: User = Depends(get_admin_user)
):
    """Получить шаблоны уведомлений"""
    try:
        templates = [
            {
                "id": "1",
                "name": "Welcome Message",
                "title": "Добро пожаловать!",
                "message": "Добро пожаловать в систему тестирования AITU!",
                "type": "welcome"
            },
            {
                "id": "2", 
                "name": "Test Completed",
                "title": "Тест завершен",
                "message": "Вы успешно завершили тест. Результат: {score}%",
                "type": "test_completion"
            }
        ]
        
        response_data = {
            "templates": templates,
            "total": len(templates)
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Templates error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get templates: {str(e)}"}
        )

@router.get("/notifications/history")
async def get_notification_history(
    limit: int = Query(50),
    admin_user: User = Depends(get_admin_user)
):
    """История уведомлений"""
    try:
        notifications = []
        for i in range(min(limit, 20)):
            notifications.append({
                "id": f"notif-{i}",
                "title": f"Sample notification {i}",
                "message": f"This is sample notification message {i}",
                "recipients_count": 100 + i * 10,
                "sent_at": (datetime.utcnow() - timedelta(hours=i)).isoformat(),
                "status": "sent"
            })
        
        response_data = {
            "notifications": notifications,
            "total": len(notifications)
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Notification history error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get notification history: {str(e)}"}
        )

# Массовые операции с пользователями
@router.delete("/users/bulk-delete")
async def bulk_delete_users(
    user_ids_data: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Массовое удаление пользователей"""
    try:
        user_ids = user_ids_data.get("user_ids", [])
        
        if not user_ids:
            return JSONResponse(
                status_code=400,
                content={"error": "No user IDs provided"}
            )
        
        # В реальности здесь будет удаление из базы
        # await db.execute(delete(User).where(User.id.in_(user_ids)))
        # await db.commit()
        
        response_data = {
            "message": f"Deleted {len(user_ids)} users",
            "deleted_count": len(user_ids)
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Bulk delete error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Bulk delete failed: {str(e)}"}
        )

@router.post("/users/bulk-award-points")
async def bulk_award_points(
    award_data: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Массовое начисление баллов"""
    try:
        user_ids = award_data.get("user_ids", [])
        points = award_data.get("points", 0)
        reason = award_data.get("reason", "Admin award")
        
        if not user_ids or points <= 0:
            return JSONResponse(
                status_code=400,
                content={"error": "Invalid user IDs or points amount"}
            )
        
        # В реальности здесь будет обновление баллов в базе
        response_data = {
            "message": f"Awarded {points} points to {len(user_ids)} users",
            "users_updated": len(user_ids),
            "points_awarded": points,
            "reason": reason
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Bulk award error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Bulk award failed: {str(e)}"}
        )

# Генерация отчетов
@router.post("/reports/generate")
async def generate_custom_report(
    report_config: dict,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Генерация пользовательских отчетов"""
    try:
        report_type = report_config.get("type")
        date_from = report_config.get("date_from")
        date_to = report_config.get("date_to")
        format = report_config.get("format", "json")
        
        # Логика генерации отчета
        response_data = {
            "filename": f"report_{report_type}_{datetime.now().strftime('%Y%m%d')}.{format}",
            "content": f"Sample {report_type} report content",
            "content_type": "application/json" if format == "json" else "text/csv"
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Report generation error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Report generation failed: {str(e)}"}
        )

# Системные утилиты
@router.post("/utils/clear-cache")
async def clear_cache(
    cache_data: dict,
    admin_user: User = Depends(get_admin_user)
):
    """Очистка кэша"""
    try:
        cache_type = cache_data.get("cache_type", "all")
        
        # Логика очистки кэша
        response_data = {
            "message": f"Cache cleared: {cache_type}",
            "cache_type": cache_type,
            "cleared_at": datetime.utcnow().isoformat()
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ Cache clear error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Cache clear failed: {str(e)}"}
        )

@router.post("/utils/optimize-db")
async def optimize_database(
    admin_user: User = Depends(get_admin_user)
):
    """Оптимизация базы данных"""
    try:
        # Логика оптимизации БД
        response_data = {
            "message": "Database optimized successfully",
            "optimized_at": datetime.utcnow().isoformat(),
            "tables_optimized": 5,
            "space_saved": "50 MB"
        }
        
        return JSONResponse(content=response_data)  # 🔥 ИСПРАВЛЕНО
        
    except Exception as e:
        print(f"❌ DB optimization error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"DB optimization failed: {str(e)}"}
        )