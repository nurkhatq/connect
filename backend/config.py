from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str
    
    # Redis
    redis_url: str
    
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
    domain: str = "connect-aitu.me"  # 🔥 ДОБАВЛЕНО: Недостающее поле domain
    environment: str = "production"  # 🔥 ДОБАВЛЕНО: Environment
    
    # File upload
    upload_dir: str = "uploads"
    max_file_size: int = 10 * 1024 * 1024  # 10MB
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Игнорировать дополнительные поля

# 🔥 ИСПРАВЛЕНО: Улучшенная обработка ошибок
try:
    settings = Settings()
    print(f"✅ Config loaded successfully:")
    print(f"   Domain: {settings.domain}")
    print(f"   Debug: {settings.debug}")
    print(f"   Environment: {settings.environment}")
    print(f"   Bot: @{settings.telegram_bot_username}")
    print(f"   Database: {settings.database_url.split('@')[-1] if '@' in settings.database_url else 'configured'}")
except Exception as e:
    print(f"❌ Configuration Error: {e}")
    print("📋 Please check your .env file and ensure all required fields are set:")
    print("   - DATABASE_URL")
    print("   - JWT_SECRET_KEY") 
    print("   - TELEGRAM_BOT_TOKEN")
    print("   - TELEGRAM_BOT_USERNAME")
    print("   - REDIS_URL (optional)")
    print("   - DOMAIN (optional, defaults to connect-aitu.me)")
    raise