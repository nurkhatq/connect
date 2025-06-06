from fastapi import FastAPI, HTTPException
from fastapi import UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import json
import os
import asyncio
from pathlib import Path
from database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from routers.auth import get_current_user

# Imports with better error handling
try:
    from database import init_db, get_db, health_check
    from config import settings
    from services.test_service import TestService
except ImportError as e:
    print(f'❌ Critical import error: {e}')
    print('📋 Please check:')
    print('   - All Python dependencies are installed')
    print('   - .env file exists with required configuration')
    print('   - Database connection is available')
    raise

# 🔥 ИСПРАВЛЕНО: Улучшенная инициализация Celery
def create_celery_app():
    """Create Celery app with proper error handling"""
    try:
        from celery import Celery
        from database import redis_client
        
        # Check if Redis is available
        if hasattr(redis_client, 'is_connected') and not redis_client.is_connected:
            print('⚠️ Redis not available, Celery will be disabled')
            return None
        
        celery = Celery(
            'aitu-tasks',
            broker=settings.redis_url,
            backend=settings.redis_url,
            include=['services.notification_service']
        )
        
        # Configure Celery
        celery.conf.update(
            task_serializer='json',
            accept_content=['json'],
            result_serializer='json',
            timezone='UTC',
            enable_utc=True,
            task_routes={
                'services.notification_service.*': {'queue': 'notifications'},
            }
        )
        
        print('✅ Celery initialized successfully')
        return celery
        
    except ImportError:
        print('⚠️ Celery not installed, background tasks will be disabled')
        return None
    except Exception as e:
        print(f'⚠️ Celery initialization failed: {e}')
        print('🔧 Background tasks will be disabled')
        return None

celery = create_celery_app()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print('🚀 Starting AITU Excellence Test API...')
    startup_success = True
    
    try:
        # Initialize database
        await init_db()
        print('✅ Database initialized')
        
        # Run health check
        health = await health_check()
        print(f"📊 System health: {health}")
        
        # 🔥 ДОБАВЛЕНО: Создаем uploads directory
        setup_uploads_directory()
        
        # Load test data
        await load_test_data()
        print('✅ Test data loaded')
        
        # Initialize middleware and other components
        print('✅ All components initialized successfully')
        
    except Exception as e:
        print(f'❌ Startup error: {e}')
        startup_success = False
        # Don't raise - let the app start anyway for debugging
    
    if startup_success:
        print('🎉 AITU Excellence Test API started successfully!')
    else:
        print('⚠️ API started with some issues - check logs above')
    
    yield
    
    # Shutdown
    print('🛑 Shutting down AITU Excellence Test API...')
    
    # Graceful shutdown of components
    if celery:
        try:
            celery.control.shutdown()
            print('✅ Celery workers stopped')
        except:
            pass
    
    print('👋 Shutdown complete')

# 🔥 ДОБАВЛЕНО: Setup uploads directory function
def setup_uploads_directory():
    """Setup uploads directory with proper permissions"""
    try:
        uploads_dir = Path(settings.upload_dir)
        uploads_dir.mkdir(exist_ok=True)
        print(f"📂 Uploads directory created: {uploads_dir.absolute()}")
        
        # Check if directory is writable
        test_file = uploads_dir / 'test_write.tmp'
        try:
            test_file.write_text('test')
            test_file.unlink()
            print('✅ Uploads directory is writable')
        except Exception as e:
            print(f'❌ Uploads directory write test failed: {e}')
            print(f'🔧 Please ensure {uploads_dir.absolute()} has write permissions')
            
        # Log directory info
        if uploads_dir.exists():
            files_count = len(list(uploads_dir.glob('*')))
            print(f"📊 Found {files_count} existing files in uploads directory")
            
    except Exception as e:
        print(f'❌ Failed to setup uploads directory: {e}')

app = FastAPI(
    title='AITU Excellence Test API',
    description='API for AITU Excellence Test Telegram Mini App',
    version='2.0.0',
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,  # Disable docs in production
    redoc_url="/redoc" if settings.debug else None,
    redirect_slashes=False
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# 🔥 ИСПРАВЛЕНО: Mount static files ПРАВИЛЬНО
uploads_dir = Path(settings.upload_dir)
uploads_dir.mkdir(exist_ok=True)
app.mount('/uploads', StaticFiles(directory=str(uploads_dir)), name='uploads')

# 🔥 ИСПРАВЛЕНО: Упрощенная регистрация роутеров
try:
    from routers import auth
    app.include_router(auth.router, prefix='/auth', tags=['auth'])
    print('✅ Router loaded: auth')
except ImportError as e:
    print(f'❌ Failed to load router auth: {e}')

try:
    from routers import tests
    app.include_router(tests.router, prefix='/tests', tags=['tests'])
    print('✅ Router loaded: tests')
except ImportError as e:
    print(f'❌ Failed to load router tests: {e}')

try:
    from routers import applications
    app.include_router(applications.router, prefix='/applications', tags=['applications'])
    print('✅ Router loaded: applications')
except ImportError as e:
    print(f'❌ Failed to load router applications: {e}')

try:
    from routers import users
    app.include_router(users.router, prefix='/users', tags=['users'])
    print('✅ Router loaded: users')
except ImportError as e:
    print(f'❌ Failed to load router users: {e}')

try:
    from routers import notifications
    app.include_router(notifications.router, prefix='/notifications', tags=['notifications'])
    print('✅ Router loaded: notifications')
except ImportError as e:
    print(f'❌ Failed to load router notifications: {e}')

# 🔥 ИСПРАВЛЕНО: Специальная обработка admin router
try:
    from routers import admin
    app.include_router(admin.router, prefix='/admin', tags=['admin'])
    print('✅ Router loaded: admin')
except ImportError as e:
    print(f'❌ Failed to load router admin: {e}')
except Exception as e:
    print(f'❌ Error loading admin router: {e}')
    print('⚠️ Admin panel may not be available')

async def load_test_data():
    """Load test data from JSON files"""
    try:
        test_service = TestService()
        
        data_dir = Path('data')
        if not data_dir.exists():
            print(f'⚠️ Data directory {data_dir} not found')
            print('📋 Test questions will need to be added manually')
            return
            
        test_files = [
            ('ict.json', 'ICT', 'Information and Communication Technology'),
            ('logical.json', 'Logical', 'Logical Reasoning'),
            ('reading.json', 'Reading', 'Reading Comprehension'),
            ('useofenglish.json', 'Use of English', 'English Usage'),
            ('grammar.json', 'Grammar', 'English Grammar')
        ]
        
        loaded_count = 0
        for filename, title, description in test_files:
            filepath = data_dir / filename
            if filepath.exists():
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        await test_service.load_questions_from_data(
                            category=filename.replace('.json', ''),
                            title=title,
                            description=description,
                            data=data
                        )
                    print(f'✅ Loaded {filename}')
                    loaded_count += 1
                except Exception as e:
                    print(f'❌ Error loading {filename}: {e}')
            else:
                print(f'⚠️ File not found: {filepath}')
        
        if loaded_count == 0:
            print('⚠️ No test data files were loaded')
        else:
            print(f'📊 Successfully loaded {loaded_count} test data files')
            
    except Exception as e:
        print(f'❌ Error in load_test_data: {e}')

@app.get('/')
async def root():
    """Root endpoint with API information"""
    return JSONResponse(content={
        'message': 'AITU Excellence Test API',
        'version': '2.0.0',
        'status': 'running',
        'docs': '/docs' if settings.debug else 'disabled in production',
        'health': '/health'
    })

@app.get('/ping')
async def ping():
    """Simple ping endpoint"""
    return JSONResponse(content={
        'status': 'ok', 
        'timestamp': asyncio.get_event_loop().time()
    })

@app.get('/health')
async def health_check_endpoint():
    """Comprehensive health check endpoint"""
    try:
        health = await health_check()
        
        # Determine overall status
        overall_status = 'healthy'
        if not health['database']:
            overall_status = 'unhealthy'
        elif not health['redis']:
            overall_status = 'degraded'  # Redis issues don't make the service unhealthy
        
        response = {
            'status': overall_status,
            'version': '2.0.0',
            'timestamp': health['timestamp'],
            'components': {
                'database': 'ok' if health['database'] else 'error',
                'redis': 'ok' if health['redis'] else 'degraded',
                'celery': 'ok' if celery else 'disabled'
            }
        }
        
        # Return appropriate HTTP status
        status_code = 200 if overall_status == 'healthy' else (503 if overall_status == 'unhealthy' else 200)
        
        if status_code != 200:
            return JSONResponse(status_code=status_code, content=response)
        
        return JSONResponse(content=response)
        
    except Exception as e:
        return JSONResponse(
            status_code=503, 
            content={
                'status': 'unhealthy',
                'error': f'Health check failed: {str(e)}',
                'timestamp': '2024-12-03T12:00:00Z'
            }
        )

# 🔥 ДОБАВЛЕНО: Test upload endpoint
@app.get('/test-upload')
async def test_upload_endpoint():
    """Test endpoint for upload functionality"""
    uploads_path = Path(settings.upload_dir)
    
    try:
        files_list = list(uploads_path.glob('*')) if uploads_path.exists() else []
        
        response_data = {
            'uploads_dir_exists': uploads_path.exists(),
            'uploads_dir_path': str(uploads_path.absolute()),
            'uploads_is_dir': uploads_path.is_dir(),
            'uploads_writable': os.access(str(uploads_path), os.W_OK) if uploads_path.exists() else False,
            'files_count': len(files_list),
            'sample_files': [f.name for f in files_list[:5]],  # Show first 5 files
            'settings_upload_dir': settings.upload_dir,
            'settings_max_file_size': settings.max_file_size,
            'current_working_dir': os.getcwd(),
            'upload_dir_size_mb': sum(f.stat().st_size for f in files_list if f.is_file()) / (1024*1024) if files_list else 0
        }
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        error_response = {
            'error': f'Failed to check uploads directory: {str(e)}',
            'uploads_dir_path': str(uploads_path.absolute()),
            'settings_upload_dir': settings.upload_dir,
            'current_working_dir': os.getcwd()
        }
        return JSONResponse(content=error_response)

# 🔥 ИСПРАВЛЕНО: Улучшенный публичный endpoint для тестов
@app.get('/api/tests')
async def get_tests_public():
    """Public endpoint for tests (no authentication required)"""
    try:
        from database import SessionLocal
        from models.test import Test
        from sqlalchemy import select
        
        async with SessionLocal() as db:
            result = await db.execute(
                select(Test).where(Test.is_active == True).order_by(Test.title)
            )
            tests = result.scalars().all()
            
            tests_data = [
                {
                    'id': test.id,
                    'title': test.title,
                    'description': test.description,
                    'category': test.category,
                    'time_limit': test.time_limit,
                    'questions_count': test.questions_count,
                    'passing_score': test.passing_score,
                    'best_score': None,  # No user context in public endpoint
                }
                for test in tests
            ]
            
            return JSONResponse(content=tests_data)
            
    except Exception as e:
        print(f'❌ Error in public tests endpoint: {e}')
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to load tests"}
        )

# 🔥 ИСПРАВЛЕНО: Direct endpoints с JSONResponse
@app.post("/applications")
async def submit_application_direct(
    application_data: dict,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Direct application submission endpoint"""
    print(f"🎯 Direct POST /applications called with data: {application_data}")
    
    try:
        # Импортируем функцию и модели из роутера
        from routers.applications import submit_application, ApplicationSubmissionModel, PersonalDataModel, EducationModel
        
        # Преобразуем dict в правильные модели
        personal_data = PersonalDataModel(**application_data.get('personal_data', {}))
        education = EducationModel(**application_data.get('education', {}))
        
        validated_data = ApplicationSubmissionModel(
            personal_data=personal_data,
            education=education,
            documents=application_data.get('documents', [])
        )
        
        # Вызываем оригинальную функцию
        result = await submit_application(validated_data, current_user, db)
        print(f"✅ Application submitted successfully: {result}")
        
        # 🔥 ИСПРАВЛЕНО: Убедимся что datetime конвертированы
        if isinstance(result, dict) and 'submitted_at' in result:
            if hasattr(result['submitted_at'], 'isoformat'):
                result['submitted_at'] = result['submitted_at'].isoformat()
        
        return JSONResponse(content=result)
        
    except Exception as e:
        print(f"❌ Direct application submission error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/applications")
async def get_applications_direct(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Direct get applications endpoint"""
    print(f"🎯 Direct GET /applications called")
    
    try:
        from routers.applications import get_user_applications
        result = await get_user_applications(current_user, db)
        print(f"✅ Applications retrieved: {len(result)} items")
        
        # 🔥 ИСПРАВЛЕНО: Убедимся что все datetime конвертированы
        for app in result:
            if 'created_at' in app and hasattr(app['created_at'], 'isoformat'):
                app['created_at'] = app['created_at'].isoformat()
            if 'updated_at' in app and app['updated_at'] and hasattr(app['updated_at'], 'isoformat'):
                app['updated_at'] = app['updated_at'].isoformat()
        
        return JSONResponse(content=result)
        
    except Exception as e:
        print(f"❌ Get applications error: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/applications/upload")
async def upload_document_direct(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Direct upload endpoint"""
    print(f"🎯 Direct POST /applications/upload called for file: {file.filename}")
    
    try:
        from routers.applications import upload_document
        result = await upload_document(file, current_user)
        print(f"✅ File uploaded successfully: {result}")
        
        # 🔥 ИСПРАВЛЕНО: Убедимся что uploaded_at это строка
        if isinstance(result, dict) and 'uploaded_at' in result:
            if hasattr(result['uploaded_at'], 'isoformat'):
                result['uploaded_at'] = result['uploaded_at'].isoformat()
        
        return JSONResponse(content=result)
        
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

# 🔥 ИСПРАВЛЕНО: Error handlers с JSONResponse
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "error": "Not Found",
            "message": "The requested resource was not found",
            "status_code": 404
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error", 
            "message": "An internal error occurred",
            "status_code": 500
        }
    )

if __name__ == '__main__':
    import uvicorn
    print('🚀 Starting development server...')
    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=8000,
        reload=settings.debug,
        log_level='info' if settings.debug else 'warning'
    )