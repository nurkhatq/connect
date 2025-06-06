from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
import asyncio
import os
from pathlib import Path
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import оптимизированных компонентов
from core.vectorstore_manager import VectorstoreManager
from core.cache_manager import CacheManager
from core.async_processor import AsyncDocumentProcessor
from app.embeddings import embeddings
from config import settings

# Import существующих endpoints
from api_endpoints.teacher import router as teacher_router
from api_endpoints.student import router as student_router
from api_endpoints.flowchart import router as flowchart_router
from api_endpoints.docs import router as docs_router
from api_endpoints.chat import router as chat_router
from api_endpoints.generate import router as generate_router

# Глобальные менеджеры
teacher_vectorstore_manager: Optional[VectorstoreManager] = None
student_vectorstore_manager: Optional[VectorstoreManager] = None
cache_manager: Optional[CacheManager] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info('🚀 Starting AITU Chat Service with optimizations...')
    
    # Создаем директории
    directories = ['data', 'data_stud', 'indexes', 'indexes_stud', 'cache', 'temp', 'tmp/generated']
    for dir_path in directories:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
    
    # Инициализируем кеш
    global cache_manager
    cache_manager = CacheManager()
    await cache_manager.initialize()
    
    # Инициализируем векторные хранилища асинхронно
    global teacher_vectorstore_manager, student_vectorstore_manager
    
    teacher_vectorstore_manager = VectorstoreManager(
        settings.data_folder,
        settings.indexes_folder,
        embeddings
    )
    
    student_vectorstore_manager = VectorstoreManager(
        settings.data_folder_stud,
        settings.indexes_folder_stud,
        embeddings
    )
    
    # Параллельная инициализация
    await asyncio.gather(
        teacher_vectorstore_manager.initialize(),
        student_vectorstore_manager.initialize()
    )
    
    logger.info('✅ All systems initialized')
    
    # Устанавливаем глобальные переменные для роутеров
    app.state.teacher_vectorstore = teacher_vectorstore_manager
    app.state.student_vectorstore = student_vectorstore_manager
    app.state.cache = cache_manager
    
    yield
    
    # Shutdown
    logger.info('🛑 Shutting down Chat Service...')
    
    # Закрываем соединения
    if cache_manager:
        await cache_manager.close()

app = FastAPI(
    title="AITU Chat Assistant API (Optimized)",
    description="High-performance chat and document assistant for AITU",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware для передачи контекста в роутеры
@app.middleware("http")
async def add_context_middleware(request, call_next):
    # Добавляем менеджеры в request state
    request.state.teacher_vectorstore = teacher_vectorstore_manager
    request.state.student_vectorstore = student_vectorstore_manager
    request.state.cache = cache_manager
    
    response = await call_next(request)
    return response

# Include routers
app.include_router(teacher_router, prefix="/api/teacher")
app.include_router(student_router, prefix="/api/student")
app.include_router(flowchart_router, prefix="/api")
app.include_router(docs_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(generate_router, prefix="/api")

@app.get("/")
async def root():
    return {
        "service": "AITU Chat Assistant (Optimized)",
        "version": "2.0.0",
        "status": "running",
        "features": {
            "cache": settings.enable_cache,
            "async_processing": True,
            "max_workers": settings.max_workers,
            "vector_optimization": True
        },
        "endpoints": {
            "teacher_chat": "/api/teacher/chat",
            "student_chat": "/api/student/chat",
            "flowchart": "/api/teacher/flowchart",
            "documents": "/api/teacher/docs"
        }
    }

@app.get("/api/health")
async def health_check():
    """Проверка здоровья с деталями"""
    health_status = {
        "status": "healthy",
        "service": "chat",
        "components": {}
    }
    
    # Проверка кеша
    if cache_manager and cache_manager.enabled:
        try:
            await cache_manager.set("health_check", "ok", ttl=10)
            cache_ok = await cache_manager.get("health_check") == "ok"
            health_status["components"]["cache"] = "ok" if cache_ok else "error"
        except:
            health_status["components"]["cache"] = "error"
    else:
        health_status["components"]["cache"] = "disabled"
    
    # Проверка векторных хранилищ
    health_status["components"]["teacher_vectorstore"] = "ok" if teacher_vectorstore_manager and teacher_vectorstore_manager.vectorstore else "not_initialized"
    health_status["components"]["student_vectorstore"] = "ok" if student_vectorstore_manager and student_vectorstore_manager.vectorstore else "not_initialized"
    
    # Общий статус
    if any(v == "error" for v in health_status["components"].values()):
        health_status["status"] = "degraded"
    
    return health_status

@app.get("/api/stats")
async def get_stats():
    """Статистика сервиса"""
    stats = {
        "cache_enabled": settings.enable_cache,
        "documents": {
            "teacher": len(list(Path(settings.data_folder).glob("**/*"))) if Path(settings.data_folder).exists() else 0,
            "student": len(list(Path(settings.data_folder_stud).glob("**/*"))) if Path(settings.data_folder_stud).exists() else 0
        }
    }
    
    if cache_manager and cache_manager.enabled:
        # Добавляем статистику кеша если доступно
        stats["cache"] = {
            "ttl": settings.cache_ttl,
            "connected": cache_manager.redis_client is not None
        }
    
    return stats

# Download endpoint
@app.get("/api/download/{filename}")
async def download_file(filename: str):
    filepath = os.path.join("tmp/generated", filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, filename=filename)
    return JSONResponse(
        status_code=404,
        content={"error": "File not found"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Отключаем reload в production
        workers=1,  # Один worker, так как используем async
        loop="uvloop"  # Быстрый event loop
    )