from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import List, Optional
import random
from datetime import datetime, timedelta, timezone
import json
from database import get_db, redis_client
from models.user import User
from models.test import Test, Question, TestSession, TestResult
from routers.auth import get_current_user
from services.test_service import TestService
from services.notification_service import NotificationService
from utils import calculate_level
from sqlalchemy.orm.attributes import flag_modified
router = APIRouter()

class StartTestRequest(BaseModel):
    test_id: str

class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer: str

@router.get("")
async def get_tests(
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get available tests"""
    query = select(Test).where(Test.is_active == True)
    if category:
        query = query.where(Test.category == category)
    
    result = await db.execute(query)
    tests = result.scalars().all()
    
    # Get user's best scores for each test
    user_scores = {}
    for test in tests:
        score_result = await db.execute(
            select(TestResult.percentage).where(
                and_(TestResult.user_id == current_user.id, TestResult.test_id == test.id)
            ).order_by(TestResult.percentage.desc()).limit(1)
        )
        best_score = score_result.scalar_one_or_none()
        user_scores[test.id] = best_score

    return [
        {
            "id": test.id,
            "title": test.title,
            "description": test.description,
            "category": test.category,
            "time_limit": test.time_limit,
            "questions_count": test.questions_count,
            "best_score": user_scores.get(test.id),
        }
        for test in tests
    ]

@router.get("/{test_id}")
async def get_test_details(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get test details"""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Get user's test history
    history_result = await db.execute(
        select(TestResult).where(
            and_(TestResult.user_id == current_user.id, TestResult.test_id == test_id)
        ).order_by(TestResult.created_at.desc()).limit(5)
    )
    history = history_result.scalars().all()
    
    return {
        "id": test.id,
        "title": test.title,
        "description": test.description,
        "category": test.category,
        "time_limit": test.time_limit,
        "questions_count": test.questions_count,
        "passing_score": test.passing_score,
        "attempts": len(history),
        "best_score": max([h.percentage for h in history]) if history else None,
        "last_attempt": history[0].created_at if history else None,
    }

@router.post("/{test_id}/start")
async def start_test(
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a new test session"""
    # Check if test exists
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Check for active session
    active_session_result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.user_id == current_user.id,
                TestSession.test_id == test_id,
                TestSession.completed == False
            )
        )
    )
    active_session = active_session_result.scalar_one_or_none()
    
    if active_session:
        # Return existing session
        questions = json.loads(active_session.questions)
        return {
            "session_id": active_session.id,
            "questions": questions,
            "time_limit": test.time_limit,
            "started_at": active_session.started_at,
        }
    
    # Get random questions
    questions_result = await db.execute(
        select(Question).where(Question.test_category == test.category)
    )
    all_questions = questions_result.scalars().all()
    
    if len(all_questions) < test.questions_count:
        raise HTTPException(status_code=400, detail="Not enough questions available")
    
    selected_questions = random.sample(list(all_questions), test.questions_count)
    
    # Create session
    session = TestSession(
        user_id=current_user.id,
        test_id=test_id,
        total_questions=len(selected_questions),
        questions=json.dumps([
            {
                "id": q.id,
                "text": q.text,
                "options": q.options,
                "type": q.question_type,
            }
            for q in selected_questions
        ])
    )
    
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    questions = json.loads(session.questions)
    
    return {
        "session_id": session.id,
        "questions": questions,
        "time_limit": test.time_limit,
        "started_at": session.started_at,
    }

@router.post("/sessions/{session_id}/answer")
async def submit_answer(
    session_id: str,
    request: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit answer for a question with race condition protection"""
    print(f"📝 Submitting answer for session: {session_id}")
    print(f"❓ Question ID: {request.question_id}")
    print(f"💬 Answer: '{request.answer}'")
    
    # 🔥 ИСПРАВЛЕНО: Используем SELECT FOR UPDATE для блокировки строки
    try:
        # Получаем сессию с блокировкой для записи
        result = await db.execute(
            select(TestSession).where(
                and_(
                    TestSession.id == session_id,
                    TestSession.user_id == current_user.id,
                    TestSession.completed == False
                )
            ).with_for_update()  # 🔥 Блокируем строку!
        )
        session = result.scalar_one_or_none()
        
        if not session:
            print(f"❌ Session not found: {session_id}")
            raise HTTPException(status_code=404, detail="Session not found or completed")
        
        # Получаем текущие ответы
        current_answers = session.answers or {}
        print(f"📊 Before: {len(current_answers)} answers stored: {list(current_answers.keys())}")
        
        # Добавляем новый ответ
        current_answers[request.question_id] = request.answer
        
        # 🔥 ИСПРАВЛЕНО: Создаем новый dict вместо изменения существующего
        session.answers = dict(current_answers)
        
        # Помечаем JSON поле как измененное
        
        flag_modified(session, 'answers')
        
        print(f"📊 After: {len(current_answers)} answers stored: {list(current_answers.keys())}")
        print(f"🔍 Full answers dict: {session.answers}")
        
        # Коммитим транзакцию
        await db.commit()
        print("✅ Answer saved to database")
        
        # 🔥 ДОБАВЛЕНО: Дополнительная проверка что действительно сохранилось
        await db.refresh(session)
        saved_answers = session.answers or {}
        print(f"🔍 Final verification - saved answers count: {len(saved_answers)}")
        print(f"🔍 Final verification - contains new answer: {request.question_id in saved_answers}")
        
        if request.question_id not in saved_answers:
            print(f"❌ CRITICAL: Answer was not saved! Retrying...")
            # Повторная попытка с новой транзакцией
            result2 = await db.execute(
                select(TestSession).where(TestSession.id == session_id).with_for_update()
            )
            session2 = result2.scalar_one_or_none()
            if session2:
                current_answers2 = session2.answers or {}
                current_answers2[request.question_id] = request.answer
                session2.answers = dict(current_answers2)
                flag_modified(session2, 'answers')
                await db.commit()
                print("✅ Retry successful")
        
    except Exception as e:
        print(f"❌ Database save error: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save answer: {str(e)}")
    
    # Update progress in Redis
    final_answers = session.answers or {}
    progress = len(final_answers) / session.total_questions * 100
    print(f"📈 Progress: {len(final_answers)}/{session.total_questions} = {progress:.1f}%")
    
    try:
        redis_client.setex(
            f"test_progress:{session_id}",
            3600,  # 1 hour
            json.dumps({"progress": progress, "answers": len(final_answers)})
        )
        print("✅ Progress saved to Redis")
    except Exception as e:
        print(f"⚠️ Redis error: {e}")
    
    return {"success": True, "progress": progress}

@router.post("/sessions/{session_id}/complete")
async def complete_test(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Complete test and calculate results"""
    print(f"🚀 Starting complete_test for session: {session_id}")
    
    # 🔥 ИСПРАВЛЕНО: Получаем сессию с блокировкой
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.id == session_id,
                TestSession.user_id == current_user.id,
                TestSession.completed == False
            )
        ).with_for_update()
    )
    session = result.scalar_one_or_none()
    if not session:
        print(f"❌ Session not found: {session_id}")
        raise HTTPException(status_code=404, detail="Session not found or completed")
    
    # 🔥 ДОБАВЛЕНО: Принудительно обновляем сессию из базы
    await db.refresh(session)
    final_answers = session.answers or {}
    
    print(f"✅ Session found, final answers count: {len(final_answers)}")
    print(f"🔍 Final answer keys: {list(final_answers.keys())}")
    
    # Используем TestService для расчета оценки
    print("🔧 Using TestService to calculate score...")
    test_service = TestService()
    score_result = await test_service.calculate_score(session, db)
    
    print(f"📊 TestService result: {score_result}")
    
    # Calculate time spent
    now = datetime.now(timezone.utc)
    started_at = session.started_at
    
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    
    time_spent = int((now - started_at).total_seconds())
    print(f"⏱️ Time spent: {time_spent} seconds")
    
    # Update session with results
    session.completed = True
    session.completed_at = now
    session.score = score_result["percentage"]
    session.correct_answers = score_result["correct"]
    session.time_spent = time_spent
    
    print(f"💾 Updating session: score={score_result['percentage']}, correct={score_result['correct']}")
    
    # Create test result
    result_record = TestResult(
        user_id=current_user.id,
        test_id=session.test_id,
        session_id=session.id,
        score=score_result["correct"],
        percentage=score_result["percentage"],
        passed=score_result["passed"],
        time_spent=time_spent,
        points_earned=score_result["points_earned"]
    )
    
    # Update user points and level
    old_points = current_user.points
    current_user.points += score_result["points_earned"]
    print(f"💰 Points: {old_points} -> {current_user.points} (+{score_result['points_earned']})")
    
    from utils import calculate_level
    old_level = current_user.level
    new_level = calculate_level(current_user.points)
    if new_level > current_user.level:
        current_user.level = new_level
        print(f"🆙 Level up: {old_level} -> {new_level}")
    
    db.add(result_record)
    await db.commit()
    print("💾 All data saved to database")
    
    # Send notification
    try:
        test_result_query = await db.execute(select(Test).where(Test.id == session.test_id))
        test = test_result_query.scalar_one_or_none()
        test_title = test.title if test else "Тест"
        
        print(f"📧 Sending notification...")
        await NotificationService.notify_test_completion(
            user_id=current_user.id,
            test_title=test_title,
            score=score_result["percentage"],
            passed=score_result["passed"],
            points_earned=score_result["points_earned"]
        )
        print("✅ Notification sent")
    except Exception as e:
        print(f"❌ Failed to send test completion notification: {e}")
    
    # Clear progress cache
    try:
        redis_client.delete(f"test_progress:{session_id}")
    except Exception as e:
        print(f"Redis error: {e}")
    
    final_result = {
        "score": score_result["correct"],
        "percentage": round(score_result["percentage"], 1),
        "correct_answers": score_result["correct"],
        "total_questions": score_result["total"],
        "passed": score_result["passed"],
        "points_earned": score_result["points_earned"],
        "time_spent": time_spent,
    }
    
    print(f"🎯 Final result: {final_result}")
    return final_result


@router.get("/sessions/{session_id}/progress")
async def get_test_progress(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get test progress"""
    try:
        cached_progress = redis_client.get(f"test_progress:{session_id}")
        if cached_progress:
            return json.loads(cached_progress)
    except Exception as e:
        print(f"Redis error: {e}")
    
    return {"progress": 0, "answers": 0}