from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    
    # Telegram
    telegram_bot_token: str
    telegram_bot_username: str
    
    # App
    app_name: str = "AITU Excellence Test"
    debug: bool = False
    
    # File upload
    upload_dir: str = "uploads"
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Игнорировать дополнительные поля

# Создаем настройки с обработкой ошибок
try:
    settings = Settings()
except Exception as e:
    print(f"⚠️  Configuration Error: {e}")
    print("📋 Please check your .env file and ensure all required fields are set:")
    print("   - DATABASE_URL")
    print("   - JWT_SECRET_KEY") 
    print("   - TELEGRAM_BOT_TOKEN")
    print("   - TELEGRAM_BOT_USERNAME")
    raise
