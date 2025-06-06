from pydantic_settings import BaseSettings
from functools import lru_cache
import os

class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.0
    
    # Paths
    data_folder: str = "/app/data"
    data_folder_stud: str = "/app/data_stud"
    indexes_folder: str = "/app/indexes"
    indexes_folder_stud: str = "/app/indexes_stud"
    cache_folder: str = "/app/cache"
    
    # Redis
    redis_url: str
    redis_password: str = ""
    
    # Performance
    enable_cache: bool = True
    cache_ttl: int = 3600  # 1 hour
    max_workers: int = 4
    request_timeout: int = 300
    
    # Vector Search
    vector_search_k: int = 5
    chunk_size: int = 512
    chunk_overlap: int = 50
    min_chunk_size: int = 256
    
    # Document Processing
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    ocr_enabled: bool = True
    
    class Config:
        env_file = ".env"
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()