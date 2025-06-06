#!/bin/bash
# ssl-simple-finish.sh - Простое завершение настройки

set -e

echo "🎉 Простое завершение настройки SSL"
echo "=================================="

source .env
DOMAIN=${DOMAIN:-connect-aitu.me}

# Остановка временных контейнеров
echo "🛑 Остановка временных контейнеров..."
docker-compose -f docker-compose.temp.yml down 2>/dev/null || true

# Проверяем что сертификаты доступны через Docker
echo "📋 Проверка сертификатов через Docker..."
docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt certbot/certbot certificates

# Создаем обновленный docker-compose.prod.yml  
echo "📝 Создание production конфигурации..."
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
      - NEXT_PUBLIC_API_URL=https://$DOMAIN/api
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

echo "✅ Production конфигурация создана"

# Пересобираем frontend с новым API URL
echo "🔨 Пересборка frontend для HTTPS..."
docker-compose -f docker-compose.prod.yml build frontend

# Запуск
echo "🚀 Запуск production с SSL..."
docker-compose -f docker-compose.prod.yml up -d

echo "⏳ Ожидание запуска (30 секунд)..."
sleep 30

echo ""
echo "📊 Статус контейнеров:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🧪 Проверка nginx..."
docker-compose -f docker-compose.prod.yml logs nginx | tail -10

echo ""
echo "🌐 Тестирование HTTPS..."
curl -I https://$DOMAIN 2>/dev/null | head -3 || echo "⚠️  HTTPS пока недоступен"

echo ""
echo "🔧 Тестирование API..."
curl -s https://$DOMAIN/api/ping || echo "⚠️  API пока недоступен"

echo ""
echo "🎉 Настройка завершена!"
echo "📱 Ваш Telegram Mini App: https://$DOMAIN"
echo "🔧 API endpoint: https://$DOMAIN/api"
echo ""
echo "✅ Если есть ошибки, проверьте логи: docker-compose -f docker-compose.prod.yml logs"
