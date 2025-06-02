from sqlalchemy import Column, String, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from database import Base
import uuid

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, nullable=False)  # 'test_result', 'application_status', 'achievement', 'reminder'
    read = Column(Boolean, default=False)
    data = Column(JSON, nullable=True)  # Additional data for the notification
    created_at = Column(DateTime(timezone=True), server_default=func.now())
