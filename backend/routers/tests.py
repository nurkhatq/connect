from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import List, Optional
import random
from datetime import datetime, timedelta
import json
from database import get_db, redis_client
from models.user import User
from models.test import Test, Question, TestSession, TestResult
from routers.auth import get_current_user
from services.test_service import TestService

router = APIRouter()

class StartTestRequest(BaseModel):
    test_id: str

class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer: str

@router.get("/")
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
    """Submit answer for a question"""
    # Get session
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.id == session_id,
                TestSession.user_id == current_user.id,
                TestSession.completed == False
            )
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or completed")
    
    # Update answers
    answers = session.answers or {}
    answers[request.question_id] = request.answer
    session.answers = answers
    
    await db.commit()
    
    # Cache progress in Redis
    progress = len(answers) / session.total_questions * 100
    await redis_client.setex(
        f"test_progress:{session_id}",
        3600,  # 1 hour
        json.dumps({"progress": progress, "answers": len(answers)})
    )
    
    return {"success": True, "progress": progress}

@router.post("/sessions/{session_id}/complete")
async def complete_test(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Complete test and calculate results"""
    # Get session
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.id == session_id,
                TestSession.user_id == current_user.id,
                TestSession.completed == False
            )
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or completed")
    
    # Calculate score
    test_service = TestService()
    score_data = await test_service.calculate_score(session, db)
    
    # Update session
    session.completed = True
    session.completed_at = datetime.utcnow()
    session.score = score_data["percentage"]
    session.correct_answers = score_data["correct"]
    session.time_spent = int((datetime.utcnow() - session.started_at).total_seconds())
    
    # Create test result
    result_record = TestResult(
        user_id=current_user.id,
        test_id=session.test_id,
        session_id=session.id,
        score=score_data["score"],
        percentage=score_data["percentage"],
        passed=score_data["passed"],
        time_spent=session.time_spent,
        points_earned=score_data["points_earned"]
    )
    
    # Update user points
    current_user.points += score_data["points_earned"]
    
    db.add(result_record)
    await db.commit()
    
    # Clear cache
    await redis_client.delete(f"test_progress:{session_id}")
    
    return {
        "score": score_data["score"],
        "percentage": score_data["percentage"],
        "correct_answers": score_data["correct"],
        "total_questions": session.total_questions,
        "passed": score_data["passed"],
        "points_earned": score_data["points_earned"],
        "time_spent": session.time_spent,
    }

@router.get("/sessions/{session_id}/progress")
async def get_test_progress(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get test progress"""
    cached_progress = await redis_client.get(f"test_progress:{session_id}")
    if cached_progress:
        return json.loads(cached_progress)
    
    return {"progress": 0, "answers": 0}
