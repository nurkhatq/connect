from sqlalchemy import create_engine, text  
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
import redis
import asyncio
from config import settings

# PostgreSQL
engine = create_async_engine(settings.database_url, echo=settings.debug)
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

# 🔥 ИСПРАВЛЕНО: Улучшенное подключение к Redis
def create_redis_client():
    """Create Redis client with proper error handling"""
    try:
        # Parse Redis URL and extract password if present
        redis_url = settings.redis_url
        print(f"🔌 Connecting to Redis: {redis_url.split('@')[-1] if '@' in redis_url else redis_url}")
        
        # Create Redis client with connection pooling
        client = redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=10,
            socket_timeout=10,
            retry_on_timeout=True,
            retry_on_error=[redis.ConnectionError, redis.TimeoutError],
            health_check_interval=30,
            max_connections=10
        )
        
        # Test connection
        client.ping()
        print("✅ Redis connected successfully")
        return client
        
    except redis.ConnectionError as e:
        print(f"❌ Redis connection failed: {e}")
        print("🔧 Redis will be disabled. Some features may not work optimally.")
        return None
    except redis.AuthenticationError as e:
        print(f"❌ Redis authentication failed: {e}")
        print("🔐 Check REDIS_PASSWORD in .env file")
        return None
    except Exception as e:
        print(f"❌ Unexpected Redis error: {e}")
        return None

# Create Redis client
redis_client = create_redis_client()

# 🔥 ИСПРАВЛЕНО: Более умная заглушка для Redis
class RedisProxy:
    """Smart Redis proxy that handles failures gracefully"""
    
    def __init__(self, real_client):
        self.real_client = real_client
        self.is_connected = real_client is not None
        self._retry_count = 0
        self._max_retries = 3
    
    def _execute_with_fallback(self, method_name, *args, **kwargs):
        """Execute Redis command with fallback"""
        if not self.is_connected:
            return self._fallback_response(method_name)
        
        try:
            method = getattr(self.real_client, method_name)
            result = method(*args, **kwargs)
            self._retry_count = 0  # Reset retry count on success
            return result
            
        except (redis.ConnectionError, redis.TimeoutError) as e:
            print(f"⚠️ Redis {method_name} failed: {e}")
            
            # Try to reconnect if we haven't exceeded retry limit
            if self._retry_count < self._max_retries:
                self._retry_count += 1
                try:
                    self.real_client.ping()
                    print(f"🔄 Redis reconnected on attempt {self._retry_count}")
                    method = getattr(self.real_client, method_name)
                    return method(*args, **kwargs)
                except:
                    pass
            
            # If all retries failed, disable Redis temporarily
            if self._retry_count >= self._max_retries:
                print("🔴 Redis disabled after max retries")
                self.is_connected = False
            
            return self._fallback_response(method_name)
            
        except Exception as e:
            print(f"❌ Unexpected Redis error in {method_name}: {e}")
            return self._fallback_response(method_name)
    
    def _fallback_response(self, method_name):
        """Return appropriate fallback response"""
        if method_name in ['get', 'hget', 'lrange']:
            return None
        elif method_name in ['setex', 'set', 'hset', 'lpush', 'delete']:
            return True
        elif method_name == 'ping':
            return False
        else:
            return None
    
    def setex(self, key, time, value):
        return self._execute_with_fallback('setex', key, time, value)
    
    def get(self, key):
        return self._execute_with_fallback('get', key)
    
    def set(self, key, value, ex=None):
        return self._execute_with_fallback('set', key, value, ex=ex)
    
    def delete(self, *keys):
        return self._execute_with_fallback('delete', *keys)
    
    def incr(self, key):
        return self._execute_with_fallback('incr', key)
    
    def ping(self):
        return self._execute_with_fallback('ping')
    
    def exists(self, key):
        return self._execute_with_fallback('exists', key)
    
    def expire(self, key, time):
        return self._execute_with_fallback('expire', key, time)
    
    def ttl(self, key):
        return self._execute_with_fallback('ttl', key)

# Create smart Redis proxy
redis_client = RedisProxy(redis_client)

async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    """Initialize database tables"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables initialized")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        raise

async def check_db_connection():
    """Check database connection"""
    try:
        async with engine.begin() as conn:
            # 🔥 ИСПРАВЛЕНО: Используем text() для SQL
            from sqlalchemy import text
            await conn.execute(text("SELECT 1"))
        print("✅ Database connection OK")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

async def check_redis_connection():
    """Check Redis connection"""
    try:
        result = redis_client.ping()
        if result:
            print("✅ Redis connection OK")
            return True
        else:
            print("⚠️ Redis not available")
            return False
    except Exception as e:
        print(f"❌ Redis check failed: {e}")
        return False

# 🔥 ДОБАВЛЕНО: Health check функция
async def health_check():
    """Comprehensive health check"""
    health = {
        "database": await check_db_connection(),
        "redis": await check_redis_connection(),
        "timestamp": asyncio.get_event_loop().time()
    }
    
    return health