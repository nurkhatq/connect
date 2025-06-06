from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, Float
from sqlalchemy.sql import func
from database import Base
from sqlalchemy.ext.mutable import MutableDict
import uuid

class Test(Base):
    __tablename__ = "tests"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String, nullable=False)  # 'ict', 'logical', 'reading', etc.
    time_limit = Column(Integer, default=3600)  # seconds
    passing_score = Column(Integer, default=70)  # percentage
    questions_count = Column(Integer, default=20)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    test_category = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    options = Column(JSON, nullable=True)  # List of options for multiple choice
    correct_answer = Column(JSON, nullable=False)
    explanation = Column(Text)
    question_type = Column(String, default="multiple_choice")
    difficulty = Column(Integer, default=1)  # 1-5 scale
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TestSession(Base):
    __tablename__ = "test_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    test_id = Column(String, nullable=False)
    questions = Column(JSON)  # Selected questions for this session
    answers = Column(MutableDict.as_mutable(JSON), default=lambda: {})  # 🔥 ИСПРАВЛЕНО: MutableDict с default factory
    score = Column(Float, nullable=True)
    total_questions = Column(Integer)
    correct_answers = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    time_spent = Column(Integer, default=0)  # seconds

class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    test_id = Column(String, nullable=False)
    session_id = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    percentage = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)
    time_spent = Column(Integer, nullable=False)
    points_earned = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())