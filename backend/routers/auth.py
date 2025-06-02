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
        
        # Verify hash
        if not hmac.compare_digest(received_hash, calculated_hash):
            raise HTTPException(status_code=401, detail="Invalid Telegram data")
        
        # Parse user data
        user_data = json.loads(parsed_data.get('user', '{}'))
        return user_data
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Failed to verify Telegram data: {str(e)}")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
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

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Verify Telegram data
    telegram_user = verify_telegram_data(request.init_data)
    
    # Find or create user
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_user.get('id'))
    )
    user = result.scalar_one_or_none()
    
    if not user:
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
    
    # Create access token
    access_token = create_access_token(data={"sub": user.id})
    
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
    access_token = create_access_token(data={"sub": current_user.id})
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