from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import your models
from database import Base
from models.user import User
from models.test import Test, Question, TestSession, TestResult  
from models.application import Application
from models.notifications import Notification

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata
target_metadata = Base.metadata

def get_url():
    """Get database URL from environment variables"""
    # 🔥 ИСПРАВЛЕНО: Используем правильные настройки из .env
    database_url = os.getenv("DATABASE_URL")
    
    if database_url:
        print(f"✅ Using DATABASE_URL from environment")
        return database_url
    
    # 🔥 ИСПРАВЛЕНО: Fallback с правильными настройками для Docker
    user = os.getenv("POSTGRES_USER", "aitu_user")
    password = os.getenv("POSTGRES_PASSWORD", "aitu_production_password_2024_secure")
    host = os.getenv("POSTGRES_HOST", "db")  # Docker container name
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "aitu_db")
    
    fallback_url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    print(f"⚠️ DATABASE_URL not found, using fallback: postgresql://{user}:***@{host}:{port}/{database}")
    return fallback_url

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Get database URL
    database_url = get_url()
    
    # Update config with the correct URL
    config.set_main_option("sqlalchemy.url", database_url)
    
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()