#!/bin/bash
# ssl-finish.sh - Завершение настройки SSL

set -e

echo "🎉 Завершение настройки SSL сертификатов"
echo "======================================"

# Загружаем переменные окружения
source .env
DOMAIN=${DOMAIN:-connect-aitu.me}

# Проверяем сертификаты
echo "📋 Проверка полученных сертификатов..."
if [ -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Сертификаты найдены локально!"
else
    echo "🔍 Сертификаты получены в контейнере, копируем локально..."
    
    # Создаем директории если их нет
    mkdir -p certbot/conf/live/$DOMAIN
    mkdir -p certbot/conf/archive/$DOMAIN
    
    # Проверяем сертификаты в docker volume или создаем заново
    docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt certbot/certbot certificates || {
        echo "⚠️  Сертификаты не найдены, но Let's Encrypt сообщил об успехе."
        echo "🔄 Пересоздаем сертификаты..."
        
        # Остановим временные контейнеры если они работают
        docker-compose -f docker-compose.temp.yml down 2>/dev/null || true
        
        # Запустим снова
        docker-compose -f docker-compose.temp.yml up -d
        sleep 30
        
        # Получим сертификаты еще раз
        docker run --rm \
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
          --force-renewal \
          -d $DOMAIN \
          -d www.$DOMAIN
    }
fi

# Проверяем снова
if [ -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Сертификаты готовы!"
    echo "📋 Информация о сертификате:"
    openssl x509 -in certbot/conf/live/$DOMAIN/fullchain.pem -noout -dates
else
    echo "❌ Не удалось найти сертификаты"
    exit 1
fi

# Остановка временных контейнеров
echo ""
echo "🛑 Остановка временных контейнеров..."
docker-compose -f docker-compose.temp.yml down

# Обновление docker-compose.prod.yml
echo ""
echo "📝 Обновление производственной конфигурации..."

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

# Запуск производственной конфигурации
echo ""
echo "🚀 Запуск производственной конфигурации с SSL..."
docker-compose -f docker-compose.prod.yml up -d

# Ждем запуска
echo "⏳ Ожидание запуска контейнеров..."
sleep 30

# Финальная проверка
echo ""
echo "📊 Статус контейнеров:"
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "🧪 Проверка HTTPS..."
curl -I https://$DOMAIN 2>/dev/null | head -5 || echo "⚠️  HTTPS пока недоступен, подождите немного"

echo ""
echo "🎉 SSL настройка завершена!"
echo "🌐 Ваш сайт: https://$DOMAIN"
echo "🔧 API endpoint: https://$DOMAIN/api"
echo ""
echo "✅ Готово! Фронтенд теперь может подключиться к бэкенду через HTTPS!"
