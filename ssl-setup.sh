#!/bin/bash
# ssl-setup.sh - Скрипт для получения SSL сертификатов

set -e

echo "🔐 AITU Excellence Test - SSL Setup"
echo "=================================="

# Проверка наличия docker и docker-compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не найден!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose не найден!"
    exit 1
fi

# Проверка .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

# Загружаем переменные окружения
source .env

echo "📧 Email для Let's Encrypt: ${SSL_EMAIL:-admin@aitu.edu.kz}"
echo "🌐 Domain: ${DOMAIN:-connect-aitu.me}"

# Шаг 1: Остановка всех контейнеров
echo ""
echo "1️⃣  Остановка всех контейнеров..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
docker-compose -f docker-compose.temp.yml down 2>/dev/null || true

# Шаг 2: Запуск временной конфигурации
echo ""
echo "2️⃣  Запуск временной HTTP конфигурации..."
docker-compose -f docker-compose.temp.yml up -d

# Ждем запуска nginx
echo "⏳ Ожидание запуска nginx..."
sleep 30

# Проверяем статус
echo "📊 Статус контейнеров:"
docker-compose -f docker-compose.temp.yml ps

# Шаг 3: Создание директорий для certbot
echo ""
echo "3️⃣  Подготовка директорий для certbot..."
mkdir -p certbot/conf
mkdir -p certbot/www

# Шаг 4: Получение сертификатов
echo ""
echo "4️⃣  Получение SSL сертификатов..."

# Запуск certbot
docker run -it --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  --network aitu-excellence-test_aitu-network \
  certbot/certbot \
  certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email ${SSL_EMAIL:-admin@aitu.edu.kz} \
  --agree-tos \
  --no-eff-email \
  -d ${DOMAIN:-connect-aitu.me} \
  -d www.${DOMAIN:-connect-aitu.me}

# Шаг 5: Проверка сертификатов
echo ""
echo "5️⃣  Проверка полученных сертификатов..."
if [ -f "certbot/conf/live/${DOMAIN:-connect-aitu.me}/fullchain.pem" ]; then
    echo "✅ Сертификаты успешно получены!"
    
    # Показываем информацию о сертификате
    echo "📋 Информация о сертификате:"
    openssl x509 -in certbot/conf/live/${DOMAIN:-connect-aitu.me}/fullchain.pem -noout -dates
else
    echo "❌ Ошибка получения сертификатов!"
    echo "🔍 Проверьте логи certbot выше"
    exit 1
fi

# Шаг 6: Остановка временных контейнеров
echo ""
echo "6️⃣  Остановка временных контейнеров..."
docker-compose -f docker-compose.temp.yml down

# Шаг 7: Обновление docker-compose.prod.yml
echo ""
echo "7️⃣  Обновление docker-compose.prod.yml..."

# Создаем обновленный docker-compose.prod.yml
cat > docker-compose.prod.yml << PRODEOF
services:
  frontend:
    build: 
      context: ./frontend
      dockerfile: Dockerfile
      target: runner
    container_name: aitu_frontend_prod
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_API_URL=https://${DOMAIN:-connect-aitu.me}/api
      - NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=\${TELEGRAM_BOT_USERNAME}
    depends_on:
      - backend
    networks:
      - aitu-network
    restart: unless-stopped

  backend:
    build: ./backend
    container_name: aitu_backend_prod
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - REDIS_URL=redis://:\${REDIS_PASSWORD}@redis:6379
      - JWT_SECRET_KEY=\${JWT_SECRET_KEY}
      - TELEGRAM_BOT_TOKEN=\${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_BOT_USERNAME=\${TELEGRAM_BOT_USERNAME}
      - APP_NAME=\${APP_NAME}
      - DEBUG=\${DEBUG}
      - ENVIRONMENT=\${ENVIRONMENT}
      - DOMAIN=\${DOMAIN}
      - UPLOAD_DIR=\${UPLOAD_DIR}
      - MAX_FILE_SIZE=\${MAX_FILE_SIZE}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend/uploads:/app/uploads
    networks:
      - aitu-network
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    container_name: aitu_postgres_prod
    environment:
      - POSTGRES_USER=\${POSTGRES_USER}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - aitu-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER} -d \${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: aitu_redis_prod
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD}
    environment:
      - REDIS_PASSWORD=\${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - aitu-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "\${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: aitu_nginx_prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/logs:/var/log/nginx
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - frontend
      - backend
    networks:
      - aitu-network
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local

networks:
  aitu-network:
    driver: bridge
PRODEOF

# Шаг 8: Запуск производственной конфигурации
echo ""
echo "8️⃣  Запуск производственной конфигурации с SSL..."
docker-compose -f docker-compose.prod.yml up -d

# Ждем запуска
sleep 20

# Финальная проверка
echo ""
echo "🎉 SSL настройка завершена!"
echo ""
echo "📊 Статус контейнеров:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🌐 Проверьте сайт: https://${DOMAIN:-connect-aitu.me}"
echo ""
echo "✅ Готово! Ваш сайт теперь работает с SSL сертификатами."
