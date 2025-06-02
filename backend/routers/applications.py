from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
import uuid
import aiofiles
from database import get_db
from models.user import User
from models.application import Application
from routers.auth import get_current_user
from config import settings

router = APIRouter()

class PersonalDataModel(BaseModel):
    iin: str
    gender: str
    birth_date: str

class EducationModel(BaseModel):
    degree: str
    program: str
    ent_score: int

class ApplicationSubmissionModel(BaseModel):
    personal_data: PersonalDataModel
    education: EducationModel
    documents: List[str] = []

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload document file"""
    if file.size > settings.max_file_size:
        raise HTTPException(status_code=413, detail="File too large")
    
    # Check file type
    allowed_types = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Generate unique filename
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(settings.upload_dir, filename)
    
    # Create upload directory if it doesn't exist
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    return {
        "filename": filename,
        "original_name": file.filename,
        "size": file.size,
        "url": f"/uploads/{filename}"
    }

@router.post("/")
async def submit_application(
    application_data: ApplicationSubmissionModel,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit new application"""
    # Check if user already has pending application
    existing_result = await db.execute(
        select(Application).where(
            and_(
                Application.user_id == current_user.id,
                Application.status.in_(["submitted", "reviewing"])
            )
        )
    )
    existing_app = existing_result.scalar_one_or_none()
    
    if existing_app:
        raise HTTPException(
            status_code=400,
            detail="You already have a pending application"
        )
    
    # Create application
    application = Application(
        user_id=current_user.id,
        personal_data=application_data.personal_data.dict(),
        education=application_data.education.dict(),
        documents=application_data.documents,
        status="submitted"
    )
    
    db.add(application)
    await db.commit()
    await db.refresh(application)
    
    # TODO: Send notification to admin
    # TODO: Send confirmation to user
    
    return {
        "id": application.id,
        "status": application.status,
        "submitted_at": application.created_at,
        "message": "Application submitted successfully"
    }

@router.get("/")
async def get_user_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's applications"""
    result = await db.execute(
        select(Application).where(Application.user_id == current_user.id)
        .order_by(Application.created_at.desc())
    )
    applications = result.scalars().all()
    
    return [
        {
            "id": app.id,
            "status": app.status,
            "personal_data": app.personal_data,
            "education": app.education,
            "documents": app.documents,
            "created_at": app.created_at,
            "updated_at": app.updated_at,
        }
        for app in applications
    ]

@router.get("/{application_id}")
async def get_application_details(
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get application details"""
    result = await db.execute(
        select(Application).where(
            and_(
                Application.id == application_id,
                Application.user_id == current_user.id
            )
        )
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {
        "id": application.id,
        "status": application.status,
        "personal_data": application.personal_data,
        "education": application.education,
        "documents": application.documents,
        "created_at": application.created_at,
        "updated_at": application.updated_at,
    }
