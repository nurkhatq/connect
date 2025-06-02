from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import json
import os
import asyncio
from pathlib import Path

# Imports with error handling
try:
    from database import init_db, get_db
    from config import settings
    from services.test_service import TestService
except ImportError as e:
    print(f'Import error: {e}')
    print('Make sure all required files exist and .env is configured')
    raise

# Celery initialization
def create_celery_app():
    try:
        from celery import Celery
        celery = Celery(
            'aitu-tasks',
            broker=settings.redis_url,
            backend=settings.redis_url,
            include=['services.notification_service']
        )
        return celery
    except Exception as e:
        print(f'Celery initialization failed: {e}')
        return None

celery = create_celery_app()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print('Starting AITU Excellence Test API...')
    try:
        await init_db()
        print('Database initialized')
        
        await load_test_data()
        print('Test data loaded')
    except Exception as e:
        print(f'Startup error: {e}')
    
    yield
    
    # Shutdown
    print('Shutting down...')

app = FastAPI(
    title='AITU Excellence Test API',
    description='API for AITU Excellence Test Telegram Mini App',
    version='1.0.0',
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Create uploads directory
uploads_dir = Path('uploads')
uploads_dir.mkdir(exist_ok=True)

# Mount static files
app.mount('/uploads', StaticFiles(directory='uploads'), name='uploads')

# Import routers
try:
    from routers import auth, tests, applications, users, notifications
    
    app.include_router(auth.router, prefix='/auth', tags=['auth'])
    app.include_router(tests.router, prefix='/tests', tags=['tests'])
    app.include_router(applications.router, prefix='/applications', tags=['applications'])
    app.include_router(users.router, prefix='/users', tags=['users'])
    app.include_router(notifications.router, prefix='/notifications', tags=['notifications'])
    print('All routers loaded successfully')
except ImportError as e:
    print(f'Router import error: {e}')
    print('Some endpoints may not be available')

async def load_test_data():
    try:
        test_service = TestService()
        
        data_dir = Path('data')
        if not data_dir.exists():
            print(f'Data directory {data_dir} not found')
            return
            
        test_files = [
            ('ict.json', 'ICT', 'Information and Communication Technology'),
            ('logical.json', 'Logical', 'Logical Reasoning'),
            ('reading.json', 'Reading', 'Reading Comprehension'),
            ('useofenglish.json', 'Use of English', 'English Usage'),
            ('grammar.json', 'Grammar', 'English Grammar')
        ]
        
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
                    print(f'Loaded {filename}')
                except Exception as e:
                    print(f'Error loading {filename}: {e}')
            else:
                print(f'File not found: {filepath}')
    except Exception as e:
        print(f'Error in load_test_data: {e}')

@app.get('/')
async def root():
    return {
        'message': 'AITU Excellence Test API',
        'version': '1.0.0',
        'status': 'running'
    }

@app.get('/ping')
async def ping():
    return {'status': 'ok'}

@app.get('/health')
async def health_check():
    try:
        async for db in get_db():
            break
        
        try:
            from database import redis_client
            redis_client.ping()
            redis_status = 'ok'
        except Exception:
            redis_status = 'unavailable'
        
        return {
            'status': 'healthy', 
            'database': 'ok', 
            'redis': redis_status,
            'version': '1.0.0'
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'Service unhealthy: {str(e)}')

# PUBLIC TESTS ENDPOINT (NO AUTH)
@app.get('/api/tests')
async def get_tests_public():
    from database import SessionLocal
    from models.test import Test
    from sqlalchemy import select
    
    async with SessionLocal() as db:
        result = await db.execute(select(Test).where(Test.is_active == True))
        tests = result.scalars().all()
        
        return [
            {
                'id': test.id,
                'title': test.title,
                'description': test.description,
                'category': test.category,
                'time_limit': test.time_limit,
                'questions_count': test.questions_count,
                'best_score': None,
            }
            for test in tests
        ]

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
