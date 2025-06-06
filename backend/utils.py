import hashlib
import hmac
import json
import re
from urllib.parse import unquote, parse_qsl
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import secrets
import string

def verify_telegram_init_data(init_data: str, bot_token: str) -> Dict[str, Any]:
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
            bot_token.encode(),
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
            raise ValueError("Invalid hash")
        
        # Parse user data
        user_data = json.loads(parsed_data.get('user', '{}'))
        
        # Check timestamp (data should not be older than 24 hours)
        auth_date = int(parsed_data.get('auth_date', 0))
        current_timestamp = int(datetime.now().timestamp())
        if current_timestamp - auth_date > 86400:  # 24 hours
            raise ValueError("Init data is too old")
        
        return user_data
        
    except Exception as e:
        raise ValueError(f"Failed to verify Telegram data: {str(e)}")

def validate_iin(iin: str) -> bool:
    """Validate Kazakhstan IIN"""
    if not iin or len(iin) != 12 or not iin.isdigit():
        return False
    
    # Check date validity
    year = int(iin[0:2])
    month = int(iin[2:4])
    day = int(iin[4:6])
    
    # Determine century
    century_digit = int(iin[6])
    if century_digit in [1, 2]:
        year += 1900
    elif century_digit in [3, 4]:
        year += 2000
    else:
        return False
    
    # Validate date
    try:
        datetime(year, month, day)
    except ValueError:
        return False
    
    # Validate check digit
    weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    sum1 = sum(int(iin[i]) * weights[i] for i in range(11))
    
    check_digit = sum1 % 11
    if check_digit == 10:
        weights2 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2]
        sum2 = sum(int(iin[i]) * weights2[i] for i in range(11))
        check_digit = sum2 % 11
    
    return check_digit == int(iin[11])

def generate_random_string(length: int = 32) -> str:
    """Generate a random string"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage"""
    # Remove path separators and special characters
    filename = re.sub(r'[^\w\s.-]', '', filename)
    # Replace spaces with underscores
    filename = re.sub(r'\s+', '_', filename)
    # Limit length
    if len(filename) > 255:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:250 - len(ext)] + ('.' + ext if ext else '')
    
    return filename

def calculate_level(points: int) -> int:
    """Calculate user level based on points"""
    # Progressive level system with increasing requirements
    if points < 500:
        return 1
    elif points < 1500:
        return 2
    elif points < 3500:
        return 3
    elif points < 6500:
        return 4
    elif points < 10500:
        return 5
    elif points < 16000:
        return 6
    elif points < 23000:
        return 7
    elif points < 32000:
        return 8
    elif points < 43000:
        return 9
    elif points < 56000:
        return 10
    elif points < 72000:
        return 11
    elif points < 90000:
        return 12
    else:
        # For very high scores, calculate dynamically
        extra_levels = (points - 90000) // 20000
        return min(13 + extra_levels, 50)  # Cap at level 50

def get_level_info(level: int) -> Dict[str, Any]:
    """Get level information including required points and rewards"""
    level_thresholds = [
        0, 500, 1500, 3500, 6500, 10500, 16000, 23000, 32000, 43000, 56000, 72000, 90000
    ]
    
    if level <= len(level_thresholds):
        current_threshold = level_thresholds[level - 1] if level > 0 else 0
        next_threshold = level_thresholds[level] if level < len(level_thresholds) else level_thresholds[-1] + (level - len(level_thresholds) + 1) * 20000
    else:
        current_threshold = 90000 + (level - 13) * 20000
        next_threshold = current_threshold + 20000
    
    return {
        "level": level,
        "current_threshold": current_threshold,
        "next_threshold": next_threshold,
        "points_needed": next_threshold - current_threshold,
        "title": get_level_title(level),
        "color": get_level_color(level)
    }

def get_level_title(level: int) -> str:
    """Get level title"""
    titles = {
        1: "Новичок",
        2: "Ученик", 
        3: "Студент",
        4: "Знаток",
        5: "Эксперт",
        6: "Специалист",
        7: "Профессионал",
        8: "Мастер",
        9: "Эксперт высшего класса",
        10: "Гуру",
        11: "Легенда",
        12: "Великий мастер"
    }
    
    if level in titles:
        return titles[level]
    elif level <= 20:
        return f"Элита {level - 12}"
    else:
        return f"Трансцендент {level - 20}"

def get_level_color(level: int) -> str:
    """Get level color for UI"""
    if level <= 2:
        return "gray"
    elif level <= 4:
        return "green"
    elif level <= 6:
        return "blue"
    elif level <= 8:
        return "purple"
    elif level <= 10:
        return "yellow"
    elif level <= 12:
        return "orange"
    else:
        return "red"

def format_duration(seconds: int) -> str:
    """Format duration in human readable format"""
    if seconds < 60:
        return f"{seconds} сек"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} мин"
    else:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        if minutes > 0:
            return f"{hours} ч {minutes} мин"
        return f"{hours} ч"

def calculate_test_points(percentage: float, test_difficulty: int = 1, bonus_multiplier: float = 1.0) -> int:
    """Calculate points earned from test based on performance"""
    if percentage < 0:
        return 0
    
    # Base points calculation
    base_points = 50  # Minimum points for attempting
    
    # Performance bonus (0-100% gives 0-200 bonus points)
    performance_bonus = int(percentage * 2)
    
    # Difficulty multiplier
    difficulty_multiplier = 1.0 + (test_difficulty - 1) * 0.2
    
    # Calculate total points
    total_points = int((base_points + performance_bonus) * difficulty_multiplier * bonus_multiplier)
    
    return max(total_points, 10)  # Minimum 10 points

def get_achievement_criteria():
    """Get achievement criteria - updated with more achievements"""
    return {
        "first_test": {
            "title": "Первые шаги",
            "description": "Прошли первый тест",
            "icon": "🎯",
            "points": 100,
            "criteria": lambda user_stats: user_stats.get("total_tests", 0) >= 1
        },
        "five_tests": {
            "title": "Активный ученик",
            "description": "Прошли 5 тестов",
            "icon": "📚",
            "points": 200,
            "criteria": lambda user_stats: user_stats.get("total_tests", 0) >= 5
        },
        "ten_tests": {
            "title": "Серьезный студент", 
            "description": "Прошли 10 тестов",
            "icon": "🎓",
            "points": 300,
            "criteria": lambda user_stats: user_stats.get("total_tests", 0) >= 10
        },
        "perfect_score": {
            "title": "Отличник",
            "description": "Получили 100% в тесте",
            "icon": "⭐",
            "points": 500,
            "criteria": lambda user_stats: user_stats.get("best_score", 0) >= 100
        },
        "high_average": {
            "title": "Знаток",
            "description": "Средний балл выше 85%",
            "icon": "🧠",
            "points": 300,
            "criteria": lambda user_stats: user_stats.get("average_score", 0) >= 85
        },
        "level_5": {
            "title": "Эксперт",
            "description": "Достигли 5 уровня",
            "icon": "🏆",
            "points": 400,
            "criteria": lambda user_stats: user_stats.get("level", 1) >= 5
        },
        "level_10": {
            "title": "Мастер",
            "description": "Достигли 10 уровня", 
            "icon": "👑",
            "points": 800,
            "criteria": lambda user_stats: user_stats.get("level", 1) >= 10
        },
        "speed_demon": {
            "title": "Скоростной демон",
            "description": "Прошли тест менее чем за 10 минут с результатом 80%+",
            "icon": "⚡",
            "points": 250,
            "criteria": lambda user_stats: user_stats.get("fastest_good_test", float('inf')) < 600  # 10 minutes
        },
        "persistent": {
            "title": "Настойчивый",
            "description": "Прошли один тест 5 раз",
            "icon": "💪",
            "points": 150,
            "criteria": lambda user_stats: user_stats.get("max_test_attempts", 0) >= 5
        },
        "perfectionist": {
            "title": "Перфекционист",
            "description": "Получили 100% в 3 разных тестах",
            "icon": "💎",
            "points": 600,
            "criteria": lambda user_stats: user_stats.get("perfect_tests_count", 0) >= 3
        }
    }

def validate_email(email: str) -> bool:
    """Validate email format"""
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_pattern, email))

def validate_phone(phone: str) -> bool:
    """Validate phone number (Kazakhstan format)"""
    # Remove all non-digits
    digits_only = re.sub(r'\D', '', phone)
    
    # Check for valid Kazakhstan phone patterns
    if len(digits_only) == 11 and digits_only.startswith('7'):
        return True
    elif len(digits_only) == 10 and digits_only.startswith('7'):
        return True
    elif len(digits_only) == 10 and not digits_only.startswith('7'):
        return True
    
    return False

def normalize_phone(phone: str) -> str:
    """Normalize phone number to standard format"""
    digits_only = re.sub(r'\D', '', phone)
    
    if len(digits_only) == 11 and digits_only.startswith('7'):
        return f"+{digits_only}"
    elif len(digits_only) == 10:
        return f"+7{digits_only}"
    
    return phone  # Return original if can't normalize

def get_test_category_info():
    """Get information about test categories"""
    return {
        "ict": {
            "name": "ICT",
            "full_name": "Information and Communication Technology",
            "description": "Тест на знание информационных технологий",
            "icon": "💻",
            "color": "blue",
            "difficulty": 3
        },
        "logical": {
            "name": "Logical",
            "full_name": "Logical Reasoning",
            "description": "Тест на логическое мышление",
            "icon": "🧠",
            "color": "purple",
            "difficulty": 4
        },
        "reading": {
            "name": "Reading",
            "full_name": "Reading Comprehension", 
            "description": "Тест на понимание прочитанного",
            "icon": "📖",
            "color": "green",
            "difficulty": 2
        },
        "useofenglish": {
            "name": "Use of English",
            "full_name": "English Language Usage",
            "description": "Практическое использование английского языка",
            "icon": "🇬🇧",
            "color": "red",
            "difficulty": 3
        },
        "grammar": {
            "name": "Grammar",
            "full_name": "English Grammar",
            "description": "Тест на знание английской грамматики",
            "icon": "📝",
            "color": "orange",
            "difficulty": 2
        }
    }