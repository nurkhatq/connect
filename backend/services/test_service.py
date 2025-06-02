import json
import random
from typing import Dict, List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.test import Test, Question, TestSession
from database import redis_client
from database import get_db

class TestService:
    def __init__(self):
        self.cache_prefix = "test:"
        
    async def load_questions_from_data(self, category: str, title: str, description: str, data: Any):
        """Load questions from JSON data into database"""
        async for db in get_db():
            # Create or update test
            result = await db.execute(select(Test).where(Test.category == category))
            test = result.scalar_one_or_none()
            
            if not test:
                test = Test(
                    title=title,
                    description=description,
                    category=category,
                    time_limit=3600,  # 1 hour
                    questions_count=20
                )
                db.add(test)
            
            # Parse different data formats
            questions_data = []
            
            if category == "reading":
                # Special handling for reading comprehension
                for item in data.get("reading", []):
                    passage = item.get("passage", "")
                    for question in item.get("questions", []):
                        questions_data.append({
                            "text": f"{passage}\n\n{question['text']}",
                            "options": question.get("options", []),
                            "correct_answer": question["correctAnswer"],
                            "type": question.get("type", "multiple_choice")
                        })
            
            elif category == "useofenglish":
                # Use of English format
                for item in data.get("use_of_english", []):
                    for question in item.get("questions", []):
                        questions_data.append({
                            "text": question["text"],
                            "options": question["options"],
                            "correct_answer": question["correctAnswer"],
                            "explanation": question.get("explanation", ""),
                            "type": "multiple_choice"
                        })
            
            elif category == "grammar":
                # Grammar format
                for topic in data.get("grammar", []):
                    for question in topic.get("questions", []):
                        questions_data.append({
                            "text": question["text"],
                            "options": question["options"],
                            "correct_answer": question["correctAnswer"],
                            "explanation": question.get("explanation", ""),
                            "type": "multiple_choice"
                        })
            
            else:
                # Default format (ICT, logical)
                for item in data:
                    questions_data.append({
                        "text": item["question"],
                        "options": item["options"],
                        "correct_answer": item["answer"],
                        "explanation": item.get("explanation", ""),
                        "type": "multiple_choice"
                    })
            
            # Save questions
            for q_data in questions_data:
                # Check if question already exists
                existing = await db.execute(
                    select(Question).where(
                        Question.test_category == category,
                        Question.text == q_data["text"]
                    )
                )
                if not existing.scalar_one_or_none():
                    question = Question(
                        test_category=category,
                        text=q_data["text"],
                        options=q_data["options"],
                        correct_answer=q_data["correct_answer"],
                        explanation=q_data.get("explanation", ""),
                        question_type=q_data.get("type", "multiple_choice")
                    )
                    db.add(question)
            
            await db.commit()
            break

    async def calculate_score(self, session: TestSession, db: AsyncSession) -> Dict[str, Any]:
        """Calculate test score"""
        questions = json.loads(session.questions)
        answers = session.answers or {}
        
        correct_count = 0
        total_questions = len(questions)
        
        for question_data in questions:
            question_id = question_data["id"]
            user_answer = answers.get(question_id)
            
            if user_answer:
                # Get correct answer from database
                result = await db.execute(select(Question).where(Question.id == question_id))
                question = result.scalar_one_or_none()
                
                if question and user_answer.strip().lower() == question.correct_answer.strip().lower():
                    correct_count += 1
        
        percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0
        
        # Get test to check passing score
        result = await db.execute(select(Test).where(Test.id == session.test_id))
        test = result.scalar_one_or_none()
        passing_score = test.passing_score if test else 70
        
        passed = percentage >= passing_score
        
        # Calculate points earned
        base_points = 50
        bonus_points = int(percentage * 4.5)  # Up to 450 bonus points for 100%
        points_earned = base_points + bonus_points if passed else 0
        
        return {
            "score": correct_count,
            "total": total_questions,
            "correct": correct_count,
            "percentage": round(percentage, 2),
            "passed": passed,
            "points_earned": points_earned
        }

    async def get_leaderboard(self, db: AsyncSession, limit: int = 100) -> List[Dict]:
        """Get user leaderboard"""
        # This would require a more complex query joining users and test results
        # For now, return top users by points
        from models.user import User
        
        result = await db.execute(
            select(User).where(User.is_active == True)
            .order_by(User.points.desc())
            .limit(limit)
        )
        users = result.scalars().all()
        
        return [
            {
                "user_id": user.id,
                "username": user.username or f"{user.first_name} {user.last_name or ''}".strip(),
                "level": user.level,
                "points": user.points,
                "rank": idx + 1
            }
            for idx, user in enumerate(users)
        ]
