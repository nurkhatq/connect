import asyncio
import json
import os
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import SessionLocal, init_db
from models.user import Achievement
from models.test import Test, Question
from services.test_service import TestService

async def init_achievements():
    """Initialize default achievements"""
    achievements_data = [
        {
            "title": "Первые шаги",
            "description": "Прошли первый тест",
            "icon": "🎯",
            "points": 50
        },
        {
            "title": "Активный ученик", 
            "description": "Прошли 5 тестов",
            "icon": "📚",
            "points": 100
        },
        {
            "title": "Отличник",
            "description": "Получили 100% в тесте",
            "icon": "⭐",
            "points": 200
        },
        {
            "title": "Знаток",
            "description": "Средний балл выше 85%",
            "icon": "🧠",
            "points": 150
        },
        {
            "title": "Эксперт",
            "description": "Достигли 5 уровня",
            "icon": "🏆",
            "points": 300
        },
        {
            "title": "На огне",
            "description": "Проходили тесты 7 дней подряд",
            "icon": "🔥",
            "points": 250
        },
        {
            "title": "Мастер всех категорий",
            "description": "Прошли тесты по всем категориям",
            "icon": "👑",
            "points": 400
        }
    ]
    
    async with SessionLocal() as session:
        for achievement_data in achievements_data:
            achievement = Achievement(**achievement_data)
            session.add(achievement)
        
        await session.commit()
        print(f"✅ Initialized {len(achievements_data)} achievements")

async def create_test_records():
    """Create test records in database"""
    tests_data = [
        {
            "category": "ict",
            "title": "ICT Basics Test",
            "description": "Тест на знание основ информационных технологий",
            "time_limit": 1800,  # 30 minutes
            "passing_score": 70,
            "questions_count": 15
        },
        {
            "category": "logical",
            "title": "Logical Reasoning Test", 
            "description": "Тест на логическое мышление и анализ",
            "time_limit": 1200,  # 20 minutes
            "passing_score": 65,
            "questions_count": 10
        },
        {
            "category": "reading",
            "title": "Reading Comprehension Test",
            "description": "Тест на понимание прочитанного текста",
            "time_limit": 2400,  # 40 minutes
            "passing_score": 75,
            "questions_count": 20
        },
        {
            "category": "grammar",
            "title": "English Grammar Test",
            "description": "Тест на знание английской грамматики",
            "time_limit": 1800,  # 30 minutes
            "passing_score": 70,
            "questions_count": 25
        },
        {
            "category": "useofenglish",
            "title": "Use of English Test",
            "description": "Тест на практическое использование английского языка",
            "time_limit": 1500,  # 25 minutes
            "passing_score": 70,
            "questions_count": 15
        }
    ]
    
    async with SessionLocal() as db:
        for test_data in tests_data:
            # Check if test already exists
            result = await db.execute(
                select(Test).where(Test.category == test_data["category"])
            )
            existing_test = result.scalar_one_or_none()
            
            if not existing_test:
                # Check available questions count
                questions_result = await db.execute(
                    select(Question).where(Question.test_category == test_data["category"])
                )
                questions = questions_result.scalars().all()
                available_questions = len(questions)
                
                if available_questions == 0:
                    print(f"⚠️  No questions found for category: {test_data['category']}")
                    continue
                
                # Adjust questions count if needed
                if available_questions < test_data["questions_count"]:
                    test_data["questions_count"] = available_questions
                    print(f"📝 Adjusted {test_data['category']} questions count to {available_questions}")
                
                test = Test(
                    id=str(uuid.uuid4()),
                    title=test_data["title"],
                    description=test_data["description"],
                    category=test_data["category"],
                    time_limit=test_data["time_limit"],
                    passing_score=test_data["passing_score"],
                    questions_count=test_data["questions_count"],
                    is_active=True
                )
                
                db.add(test)
                print(f"✅ Created test: {test.title}")
            else:
                print(f"ℹ️  Test already exists: {existing_test.title}")
        
        await db.commit()

async def init_test_data():
    """Initialize test data from JSON files"""
    test_service = TestService()
    
    data_dir = "data"
    test_files = [
        ("ict.json", "ICT", "Information and Communication Technology"),
        ("logical.json", "Logical", "Logical Reasoning"),
        ("reading.json", "Reading", "Reading Comprehension"),
        ("useofenglish.json", "Use of English", "English Usage"),
        ("grammar.json", "Grammar", "English Grammar")
    ]
    
    for filename, title, description in test_files:
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                await test_service.load_questions_from_data(
                    category=filename.replace('.json', ''),
                    title=title,
                    description=description,
                    data=data
                )
            print(f"✅ Loaded questions from {filename}")
        else:
            print(f"❌ File not found: {filepath}")

async def main():
    """Main initialization function"""
    print("🚀 Initializing AITU Excellence Test database...")
    
    # Initialize database tables
    await init_db()
    print("✅ Database tables created")
    
    # Initialize achievements
    await init_achievements()
    
    # Initialize test data (questions)
    await init_test_data()
    
    # Create test records (ВАЖНО!)
    await create_test_records()
    
    # Show summary
    async with SessionLocal() as db:
        tests_result = await db.execute(select(Test))
        tests = tests_result.scalars().all()
        
        questions_result = await db.execute(select(Question))
        questions = questions_result.scalars().all()
        
        print(f"\n📊 Summary:")
        print(f"   Tests created: {len(tests)}")
        print(f"   Questions loaded: {len(questions)}")
        
        for test in tests:
            category_questions = [q for q in questions if q.test_category == test.category]
            print(f"   - {test.title}: {len(category_questions)} questions available")
    
    print("🎉 Database initialization completed!")

if __name__ == "__main__":
    asyncio.run(main())
