#!/bin/bash
# ssl-setup-debug.sh - Скрипт с отладкой

set -e

echo "🔐 AITU Excellence Test - SSL Setup (Debug Mode)"
echo "================================================"

# Загружаем переменные окружения
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    exit 1
fi

source .env
DOMAIN=${DOMAIN:-connect-aitu.me}
EMAIL=${SSL_EMAIL:-admin@aitu.edu.kz}

echo "📧 Email: $EMAIL"
echo "🌐 Domain: $DOMAIN"

# Шаг 1: Остановка всех контейнеров
echo ""
echo "1️⃣  Остановка всех контейнеров..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
docker-compose -f docker-compose.temp.yml down 2>/dev/null || true

# Шаг 2: Создание директорий
echo ""
echo "2️⃣  Создание директорий..."
mkdir -p certbot/conf
mkdir -p certbot/www
mkdir -p nginx/logs

# Проверяем права доступа
chmod 755 certbot/www
echo "📁 Директории созданы:"
ls -la certbot/

# Шаг 3: Запуск временной конфигурации
echo ""
echo "3️⃣  Запуск временной конфигурации..."
docker-compose -f docker-compose.temp.yml up -d

echo "⏳ Ожидание запуска (45 секунд)..."
sleep 45

# Шаг 4: Проверка nginx
echo ""
echo "4️⃣  Проверка nginx..."
docker-compose -f docker-compose.temp.yml logs nginx | tail -10

echo ""
echo "📊 Статус контейнеров:"
docker-compose -f docker-compose.temp.yml ps

# Шаг 5: Тестирование webroot
echo ""
echo "5️⃣  Тестирование webroot доступа..."

# Создаем тестовый файл
echo "test-challenge-file" > certbot/www/test-file.txt

# Проверяем доступность через HTTP
echo "🧪 Тестирование HTTP доступа..."
curl -v "http://$DOMAIN/.well-known/acme-challenge/../test-file.txt" || echo "❌ Тест не прошел"

# Проверяем доступность изнутри контейнера nginx
echo "🔍 Проверка изнутри nginx контейнера..."
docker exec aitu_nginx_temp ls -la /var/www/certbot/ || echo "❌ Директория недоступна"

# Шаг 6: Получение сертификатов с отладкой
echo ""
echo "6️⃣  Получение сертификатов..."

# Сначала пробуем dry-run
echo "🧪 Пробный запуск (dry-run)..."
docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  --network aitu-excellence-test_aitu-network \
  certbot/certbot \
  certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  --dry-run \
  --verbose \
  -d $DOMAIN \
  -d www.$DOMAIN

if [ $? -eq 0 ]; then
    echo "✅ Dry-run успешен! Получаем реальные сертификаты..."
    
    # Реальное получение сертификатов
    docker run -it --rm \
      -v $(pwd)/certbot/conf:/etc/letsencrypt \
      -v $(pwd)/certbot/www:/var/www/certbot \
      --network aitu-excellence-test_aitu-network \
      certbot/certbot \
      certonly \
      --webroot \
      --webroot-path=/var/www/certbot \
      --email $EMAIL \
      --agree-tos \
      --no-eff-email \
      -d $DOMAIN \
      -d www.$DOMAIN
else
    echo "❌ Dry-run не прошел!"
    echo "🔍 Проверим логи nginx..."
    docker-compose -f docker-compose.temp.yml logs nginx
    
    echo ""
    echo "🔍 Проверим доступность директории..."
    docker exec aitu_nginx_temp find /var/www/certbot -type f -name "*" | head -10
    
    exit 1
fi

# Шаг 7: Проверка сертификатов
echo ""
echo "7️⃣  Проверка сертификатов..."
if [ -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Сертификаты получены!"
    openssl x509 -in certbot/conf/live/$DOMAIN/fullchain.pem -noout -dates
    
    # Остановка временных контейнеров
    echo ""
    echo "8️⃣  Остановка временных контейнеров..."
    docker-compose -f docker-compose.temp.yml down
    
    echo ""
    echo "9️⃣  Обновление продакшн конфигурации..."
    
    # Обновляем docker-compose.prod.yml
    sed -i.bak 's|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://'$DOMAIN'/api|' docker-compose.prod.yml
    
    # Добавляем volume mappings если их нет
    if ! grep -q "certbot/conf:/etc/letsencrypt" docker-compose.prod.yml; then
        echo "⚠️  Добавляем volumes для сертификатов..."
        
        # Создаем временный файл с правильными volumes
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
    fi
    
    echo ""
    echo "🔟 Запуск продакшн конфигурации..."
    docker-compose -f docker-compose.prod.yml up -d
    
    sleep 20
    
    echo ""
    echo "🎉 SSL настройка завершена!"
    echo "📊 Статус:"
    docker-compose -f docker-compose.prod.yml ps
    
    echo ""
    echo "🌐 Проверьте: https://$DOMAIN"
    
else
    echo "❌ Сертификаты не получены!"
    echo "🔍 Логи nginx:"
    docker-compose -f docker-compose.temp.yml logs nginx
    exit 1
fi
