import redis.asyncio as redis
import pickle
import json
import hashlib
from typing import Any, Optional, Union
from datetime import timedelta
import logging

from config import settings

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.enabled = settings.enable_cache
        
    async def initialize(self):
        """Инициализация Redis подключения"""
        if not self.enabled:
            logger.info("Cache disabled")
            return
        
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=False,  # Для pickle
                password=settings.redis_password if settings.redis_password else None
            )
            # Проверяем подключение
            await self.redis_client.ping()
            logger.info("Redis cache initialized")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.enabled = False
    
    async def close(self):
        """Закрытие соединения"""
        if self.redis_client:
            await self.redis_client.close()
    
    def _make_key(self, key: str) -> str:
        """Создает ключ с префиксом"""
        return f"chat_service:{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Получить значение из кеша"""
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            full_key = self._make_key(key)
            value = await self.redis_client.get(full_key)
            
            if value:
                # Пробуем десериализовать
                try:
                    return pickle.loads(value)
                except:
                    # Если не pickle, возвращаем как строку
                    return value.decode('utf-8') if isinstance(value, bytes) else value
            
            return None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Сохранить значение в кеш"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            full_key = self._make_key(key)
            ttl = ttl or settings.cache_ttl
            
            # Сериализуем значение
            if isinstance(value, (str, int, float)):
                serialized = str(value).encode('utf-8')
            else:
                serialized = pickle.dumps(value)
            
            await self.redis_client.setex(
                full_key,
                timedelta(seconds=ttl),
                serialized
            )
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Удалить значение из кеша"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            full_key = self._make_key(key)
            result = await self.redis_client.delete(full_key)
            return bool(result)
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    async def clear_pattern(self, pattern: str) -> int:
        """Удалить все ключи по паттерну"""
        if not self.enabled or not self.redis_client:
            return 0
        
        try:
            full_pattern = self._make_key(pattern)
            keys = []
            
            # Используем SCAN для безопасного поиска ключей
            async for key in self.redis_client.scan_iter(match=full_pattern):
                keys.append(key)
            
            if keys:
                return await self.redis_client.delete(*keys)
            
            return 0
        except Exception as e:
            logger.error(f"Cache clear pattern error: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Проверить существование ключа"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            full_key = self._make_key(key)
            return bool(await self.redis_client.exists(full_key))
        except Exception as e:
            logger.error(f"Cache exists error: {e}")
            return False
    
    async def get_ttl(self, key: str) -> int:
        """Получить оставшееся время жизни ключа"""
        if not self.enabled or not self.redis_client:
            return -1
        
        try:
            full_key = self._make_key(key)
            return await self.redis_client.ttl(full_key)
        except Exception as e:
            logger.error(f"Cache TTL error: {e}")
            return -1