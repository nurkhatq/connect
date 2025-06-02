from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    MODERATOR = "moderator"

class TestCategory(str, Enum):
    ICT = "ict"
    LOGICAL = "logical"
    READING = "reading"
    USE_OF_ENGLISH = "useofenglish"
    GRAMMAR = "grammar"

class ApplicationStatus(str, Enum):
    SUBMITTED = "submitted"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACCEPTED = "accepted"

class NotificationType(str, Enum):
    TEST_RESULT = "test_result"
    APPLICATION_STATUS = "application_status"
    ACHIEVEMENT = "achievement"
    REMINDER = "reminder"

# User Schemas
class UserBase(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class User(UserBase):
    id: str
    level: int
    points: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Auth Schemas
class LoginRequest(BaseModel):
    init_data: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

# Test Schemas
class QuestionBase(BaseModel):
    text: str
    options: List[str]
    correct_answer: str
    explanation: Optional[str] = None
    question_type: str = "multiple_choice"

class Question(QuestionBase):
    id: str
    test_category: TestCategory
    difficulty: int

    class Config:
        from_attributes = True

class TestBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: TestCategory
    time_limit: int = 3600
    passing_score: int = 70
    questions_count: int = 20

class Test(TestBase):
    id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TestSessionCreate(BaseModel):
    test_id: str

class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer: str

class TestResult(BaseModel):
    id: str
    score: float
    percentage: float
    passed: bool
    time_spent: int
    points_earned: int
    created_at: datetime

    class Config:
        from_attributes = True

# Application Schemas
class PersonalData(BaseModel):
    iin: str
    gender: str
    birth_date: str

    @validator('iin')
    def validate_iin(cls, v):
        if len(v) != 12 or not v.isdigit():
            raise ValueError('IIN must be exactly 12 digits')
        return v

    @validator('gender')
    def validate_gender(cls, v):
        if v not in ['male', 'female']:
            raise ValueError('Gender must be male or female')
        return v

class Education(BaseModel):
    degree: str
    program: str
    ent_score: int

    @validator('ent_score')
    def validate_ent_score(cls, v):
        if v < 0 or v > 140:
            raise ValueError('ENT score must be between 0 and 140')
        return v

class ApplicationCreate(BaseModel):
    personal_data: PersonalData
    education: Education
    documents: List[str] = []

class Application(BaseModel):
    id: str
    user_id: str
    personal_data: Dict[str, Any]
    education: Dict[str, Any]
    documents: List[str]
    status: ApplicationStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: NotificationType
    data: Optional[Dict[str, Any]] = None

class Notification(BaseModel):
    id: str
    title: str
    message: str
    type: NotificationType
    read: bool
    data: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Achievement Schemas
class Achievement(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    icon: str
    points: int
    created_at: datetime

    class Config:
        from_attributes = True

class UserAchievement(BaseModel):
    id: str
    user_id: str
    achievement_id: str
    earned_at: datetime

    class Config:
        from_attributes = True

# Statistics Schemas
class UserStatistics(BaseModel):
    total_tests: int
    average_score: float
    best_score: float
    total_points: int

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    level: int
    points: int
    is_current_user: bool = False

class LeaderboardResponse(BaseModel):
    leaderboard: List[LeaderboardEntry]
    current_user_rank: int
    total_users: int
