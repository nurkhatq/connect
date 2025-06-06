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
from services.notification_service import NotificationService
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
    """Upload document file with improved error handling"""
    print(f"📁 Upload request from user {current_user.telegram_id}")
    print(f"📄 File: {file.filename}, Size: {file.size}, Type: {file.content_type}")
    
    try:
        # Проверка размера файла
        if file.size and file.size > settings.max_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {settings.max_file_size / (1024*1024):.1f}MB"
            )
        
        # Проверка наличия filename
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        # Проверка типа файла по расширению И content-type
        allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File extension '{file_ext}' not allowed. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Дополнительная проверка content-type
        allowed_content_types = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png', 
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        
        if file.content_type and file.content_type not in allowed_content_types:
            print(f"⚠️ Content-type '{file.content_type}' not in allowed list, but extension is OK")
            # Не блокируем, просто предупреждаем
        
        # Создаем директорию для загрузок если не существует
        upload_path = os.path.join(settings.upload_dir)
        os.makedirs(upload_path, exist_ok=True)
        print(f"📂 Upload directory: {upload_path}")
        
        # Генерируем уникальное имя файла
        unique_id = str(uuid.uuid4())
        safe_filename = f"{unique_id}{file_ext}"
        file_path = os.path.join(upload_path, safe_filename)
        
        print(f"💾 Saving to: {file_path}")
        
        # Сохраняем файл
        try:
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
                
            print(f"✅ File saved successfully: {safe_filename}")
            
            # Проверяем что файл действительно сохранился
            if not os.path.exists(file_path):
                raise HTTPException(status_code=500, detail="Failed to save file")
                
            file_size_saved = os.path.getsize(file_path)
            print(f"📊 File size on disk: {file_size_saved} bytes")
            
        except Exception as e:
            print(f"❌ File save error: {e}")
            # Удаляем файл если что-то пошло не так
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
        # Возвращаем информацию о файле
        response_data = {
            "filename": safe_filename,
            "original_name": file.filename,
            "size": file.size or file_size_saved,
            "content_type": file.content_type,
            "url": f"/uploads/{safe_filename}",
            "uploaded_at": datetime.now().isoformat()
        }
        
        print(f"✅ Upload completed: {response_data}")
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"❌ Unexpected upload error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"File upload failed: {str(e)}"
        )

@router.post("/")
async def submit_application(
    application_data: ApplicationSubmissionModel,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit new application with improved validation"""
    print(f"📋 Application submission from user {current_user.telegram_id}")
    print(f"📊 Application data: {application_data}")
    
    try:
        # Проверяем нет ли уже активной заявки
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
                detail=f"You already have a pending application (#{existing_app.id[-8:]})"
            )
        
        # Валидация ИИН
        iin = application_data.personal_data.iin
        if len(iin) != 12 or not iin.isdigit():
            raise HTTPException(
                status_code=400,
                detail="IIN must be exactly 12 digits"
            )
        
        # Валидация даты рождения
        try:
            birth_date = datetime.fromisoformat(application_data.personal_data.birth_date.replace('Z', '+00:00'))
            current_year = datetime.now().year
            birth_year = birth_date.year
            age = current_year - birth_year
            
            if age < 16 or age > 80:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid birth date. Age must be between 16 and 80 (current age: {age})"
                )
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid birth date format"
            )
        
        # Валидация пола
        if application_data.personal_data.gender not in ['male', 'female']:
            raise HTTPException(
                status_code=400,
                detail="Gender must be 'male' or 'female'"
            )
        
        # Валидация баллов ЕНТ
        ent_score = application_data.education.ent_score
        if ent_score < 0 or ent_score > 140:
            raise HTTPException(
                status_code=400,
                detail="ENT score must be between 0 and 140"
            )
        
        # Валидация документов
        if not application_data.documents or len(application_data.documents) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one document must be uploaded"
            )
        
        # Проверяем что все документы существуют
        upload_path = settings.upload_dir
        for doc_filename in application_data.documents:
            doc_path = os.path.join(upload_path, doc_filename)
            if not os.path.exists(doc_path):
                print(f"❌ Document not found: {doc_path}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Document '{doc_filename}' not found"
                )
        
        print(f"✅ All validations passed, creating application...")
        
        # Создаем заявку
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
        
        print(f"✅ Application created: {application.id}")
        
        # Отправляем уведомление
        try:
            await NotificationService.create_notification(
                user_id=current_user.id,
                title="🎉 Заявка подана успешно",
                message=f"Ваша заявка #{application.id[-8:]} получена и передана на рассмотрение приемной комиссии. Обработка займет 3-5 рабочих дней.",
                notification_type="application_status",
                data={
                    "application_id": application.id,
                    "status": "submitted",
                    "iin": application_data.personal_data.iin,
                    "program": application_data.education.program
                }
            )
            print("✅ Confirmation notification sent")
        except Exception as e:
            print(f"⚠️ Failed to send notification: {e}")
            # Не падаем если уведомление не отправилось
        
        return {
            "id": application.id,
            "status": application.status,
            "submitted_at": application.created_at.isoformat(),
            "message": "Application submitted successfully",
            "application_number": application.id[-8:],
            "next_steps": [
                "Приемная комиссия рассмотрит вашу заявку в течение 3-5 рабочих дней",
                "Вы получите уведомление о статусе заявки",
                "При одобрении с вами свяжутся для следующих шагов"
            ]
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"❌ Unexpected application submission error: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Application submission failed: {str(e)}"
        )

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
            "id": application.id,
            "status": application.status,
            "personal_data": application.personal_data,
            "education": application.education,
            "documents": application.documents,
            "created_at": application.created_at.isoformat(),  # 🔥 ИСПРАВЛЕНО
            "updated_at": application.updated_at.isoformat() if application.updated_at else None,  # 🔥 ИСПРАВЛЕНО
            "application_number": application.id[-8:],  # User-friendly short ID
        }
        for application in applications
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
        "admin_notes": application.admin_notes,
        "created_at": application.created_at.isoformat(),  # 🔥 ИСПРАВЛЕНО
        "updated_at": application.updated_at.isoformat() if application.updated_at else None,  # 🔥 ИСПРАВЛЕНО
        "application_number": application.id[-8:],
    }

# 🔥 ADMIN ENDPOINT для обновления статуса заявки
@router.put("/{application_id}/status")
async def update_application_status(
    application_id: str,
    status_data: dict,
    current_user: User = Depends(get_current_user),  # TODO: Add admin check
    db: AsyncSession = Depends(get_db)
):
    """Update application status (admin only)"""
    # TODO: Add proper admin role check
    # For now, any authenticated user can update (should be restricted to admins)
    
    new_status = status_data.get("status")
    admin_notes = status_data.get("admin_notes", "")
    
    if new_status not in ["submitted", "reviewing", "approved", "rejected", "accepted"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    old_status = application.status
    application.status = new_status
    application.admin_notes = admin_notes
    application.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # Send notification about status change
    try:
        await NotificationService.notify_application_status_change(
            user_id=application.user_id,
            application_id=application.id,
            new_status=new_status
        )
    except Exception as e:
        print(f"Failed to send status change notification: {e}")
    
    return {
        "message": f"Application status updated from {old_status} to {new_status}",
        "application_id": application.id,
        "old_status": old_status,
        "new_status": new_status
    }