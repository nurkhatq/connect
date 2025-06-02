from fastapi import Depends, HTTPException, status, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
from typing import Optional, List
import mimetypes
import os

from database import get_db
from models.user import User
from config import settings

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current admin user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    # Add admin check logic here when roles are implemented
    return current_user

def validate_file_upload(file: UploadFile) -> UploadFile:
    """Validate uploaded file"""
    # Check file size
    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.max_file_size / (1024*1024):.1f}MB"
        )
    
    # Check file type
    allowed_types = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    
    content_type = file.content_type
    if content_type not in allowed_types:
        # Try to guess from filename
        guessed_type, _ = mimetypes.guess_type(file.filename)
        if guessed_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="File type not allowed. Allowed types: PDF, JPEG, PNG, GIF, DOC, DOCX"
            )
    
    # Check filename
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    return file

class Pagination:
    def __init__(self, page: int = 1, size: int = 20):
        self.page = max(1, page)
        self.size = min(100, max(1, size))
        self.offset = (self.page - 1) * self.size
        self.limit = self.size

def get_pagination(page: int = 1, size: int = 20) -> Pagination:
    return Pagination(page, size)