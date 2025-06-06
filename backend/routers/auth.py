from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import json
import hashlib
import hmac
from urllib.parse import unquote, parse_qsl
from jose import jwt, JWTError
from datetime import datetime, timedelta
from database import get_db
from models.user import User
from config import settings

router = APIRouter()
security = HTTPBearer()

class LoginRequest(BaseModel):
    init_data: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

def verify_telegram_data(init_data: str) -> dict:
    """Verify Telegram WebApp init data"""
    try:
        # Parse the init data
        parsed_data = dict(parse_qsl(unquote(init_data)))
        
        # Extract hash and create data string
        received_hash = parsed_data.pop('hash', '')
        data_check_string = '\n'.join([f"{k}={v}" for k, v in sorted(parsed_data.items())])
        
        # Create secret key
        secret_key = hmac.new(
            "WebAppData".encode(),
            settings.telegram_bot_token.encode(),
            hashlib.sha256
        ).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        print(f"🔍 Hash verification: received={received_hash[:10]}..., calculated={calculated_hash[:10]}...")
        
        # 🔥 ИСПРАВЛЕНО: ВКЛЮЧЕНА проверка безопасности!
        if not hmac.compare_digest(received_hash, calculated_hash):
            print(f"❌ Hash mismatch! This could be a security breach.")
            print(f"   Expected: {calculated_hash}")
            print(f"   Received: {received_hash}")
            print(f"   Data string: {data_check_string}")
            raise HTTPException(
                status_code=401, 
                detail="Invalid Telegram data - hash verification failed"
            )
        
        # Parse user data
        user_data = json.loads(parsed_data.get('user', '{}'))
        
        # Additional validation
        if not user_data or 'id' not in user_data:
            raise HTTPException(
                status_code=401,
                detail="Invalid Telegram data - missing user information"
            )
        
        # Check timestamp (data should not be older than 24 hours)
        auth_date = int(parsed_data.get('auth_date', 0))
        current_timestamp = int(datetime.now().timestamp())
        if current_timestamp - auth_date > 86400:  # 24 hours
            raise HTTPException(
                status_code=401,
                detail="Invalid Telegram data - authentication data too old"
            )
        
        print(f"✅ User data verified: {user_data.get('id', 'unknown')}")
        return user_data
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        print(f"❌ Telegram data verification error: {e}")
        raise HTTPException(
            status_code=401, 
            detail=f"Failed to verify Telegram data: authentication failed"
        )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    print(f"🔑 Token created for user: {data.get('sub', 'unknown')}, expires: {expire}")
    return encoded_jwt

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        print(f"🔍 Validating token: {credentials.credentials[:20]}...")
        
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        user_id: str = payload.get("sub")
        print(f"📋 Token payload user_id: {user_id}")
        
        if user_id is None:
            print("❌ No user_id in token")
            raise credentials_exception
            
        # Check token expiration
        exp = payload.get("exp")
        if exp and datetime.utcnow().timestamp() > exp:
            print("❌ Token expired")
            raise credentials_exception
            
    except JWTError as e:
        print(f"❌ JWT Error: {e}")
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        print(f"❌ User not found in DB: {user_id}")
        raise credentials_exception
    
    if not user.is_active:
        print(f"❌ User is inactive: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
        
    print(f"✅ User authenticated: {user.telegram_id}")
    return user

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    print("🚀 Login attempt started")
    
    # Verify Telegram data with security checks
    telegram_user = verify_telegram_data(request.init_data)
    
    # Find or create user
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_user.get('id'))
    )
    user = result.scalar_one_or_none()
    
    if not user:
        print(f"👤 Creating new user: {telegram_user.get('id')}")
        # Create new user
        user = User(
            telegram_id=telegram_user.get('id'),
            username=telegram_user.get('username'),
            first_name=telegram_user.get('first_name', ''),
            last_name=telegram_user.get('last_name'),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        # Send welcome notification
        try:
            from services.notification_service import NotificationService
            await NotificationService.create_notification(
                user_id=user.id,
                title="🎉 Добро пожаловать в AITU!",
                message="Добро пожаловать в систему тестирования AITU! Начните с прохождения тестов и получайте баллы за правильные ответы.",
                notification_type="achievement",
                data={"points": 0}
            )
        except Exception as e:
            print(f"Failed to send welcome notification: {e}")
    else:
        print(f"👤 Existing user found: {user.telegram_id}")
        # Update user info from Telegram (in case it changed)
        user.username = telegram_user.get('username') or user.username
        user.first_name = telegram_user.get('first_name') or user.first_name
        user.last_name = telegram_user.get('last_name') or user.last_name
        await db.commit()
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.id, "telegram_id": user.telegram_id}
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user.id,
            "telegram_id": user.telegram_id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "level": user.level,
            "points": user.points,
        }
    )

@router.post("/refresh")
async def refresh_token(current_user: User = Depends(get_current_user)):
    access_token = create_access_token(
        data={"sub": current_user.id, "telegram_id": current_user.telegram_id}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "telegram_id": current_user.telegram_id,
        "username": current_user.username,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "level": current_user.level,
        "points": current_user.points,
        "created_at": current_user.created_at,
    }