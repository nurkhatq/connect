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
    # Level progression: 0-999 = Level 1, 1000-2999 = Level 2, etc.
    if points < 1000:
        return 1
    elif points < 3000:
        return 2
    elif points < 6000:
        return 3
    elif points < 10000:
        return 4
    elif points < 15000:
        return 5
    elif points < 25000:
        return 6
    elif points < 40000:
        return 7
    elif points < 60000:
        return 8
    elif points < 85000:
        return 9
    else:
        return 10

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

def get_achievement_criteria():
    """Get achievement criteria"""
    return {
        "first_test": {
            "title": "Первые шаги",
            "description": "Прошли первый тест",
            "icon": "🎯",
            "points": 50,
            "criteria": lambda user_stats: user_stats["total_tests"] >= 1
        },
        "five_tests": {
            "title": "Активный ученик",
            "description": "Прошли 5 тестов",
            "icon": "📚",
            "points": 100,
            "criteria": lambda user_stats: user_stats["total_tests"] >= 5
        },
        "perfect_score": {
            "title": "Отличник",
            "description": "Получили 100% в тесте",
            "icon": "⭐",
            "points": 200,
            "criteria": lambda user_stats: user_stats["best_score"] >= 100
        },
        "high_average": {
            "title": "Знаток",
            "description": "Средний балл выше 85%",
            "icon": "🧠",
            "points": 150,
            "criteria": lambda user_stats: user_stats["average_score"] >= 85
        },
        "level_5": {
            "title": "Эксперт",
            "description": "Достигли 5 уровня",
            "icon": "🏆",
            "points": 300,
            "criteria": lambda user_stats: user_stats["level"] >= 5
        }
    }
