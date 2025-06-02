from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from database import Base
import uuid

class Application(Base):
    __tablename__ = "applications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False)
    personal_data = Column(JSON, nullable=False)  # IIN, gender, birth_date
    education = Column(JSON, nullable=False)  # degree, program, ENT score
    documents = Column(JSON, default=[])  # list of uploaded document URLs
    status = Column(String, default="submitted")  # submitted, reviewing, approved, rejected, accepted
    admin_notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())