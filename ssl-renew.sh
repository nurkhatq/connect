#!/bin/bash
# ssl-renew.sh - Скрипт для обновления SSL сертификатов

set -e

echo "🔄 Обновление SSL сертификатов..."
echo "================================"

# Проверка существования сертификатов
if [ ! -d "certbot/conf/live" ]; then
    echo "❌ Сертификаты не найдены! Сначала запустите ssl-setup.sh"
    exit 1
fi

# Загружаем переменные окружения
if [ -f ".env" ]; then
    source .env
fi

DOMAIN=${DOMAIN:-connect-aitu.me}

echo "🌐 Domain: $DOMAIN"

# Проверка срока действия текущих сертификатов
echo ""
echo "📅 Текущие сертификаты:"
if [ -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    openssl x509 -in certbot/conf/live/$DOMAIN/fullchain.pem -noout -dates
    
    # Проверяем, нужно ли обновление (за 30 дней до истечения)
    exp_date=$(openssl x509 -in certbot/conf/live/$DOMAIN/fullchain.pem -noout -enddate | cut -d= -f2)
    exp_epoch=$(date -d "$exp_date" +%s)
    now_epoch=$(date +%s)
    days_left=$(( (exp_epoch - now_epoch) / 86400 ))
    
    echo "📊 Дней до истечения: $days_left"
    
    if [ $days_left -gt 30 ] && [ "$1" != "--force" ]; then
        echo "✅ Сертификат еще действителен ($days_left дней). Обновление не требуется."
        echo "💡 Для принудительного обновления запустите: $0 --force"
        exit 0
    fi
else
    echo "❌ Файл сертификата не найден!"
    exit 1
fi

# Обновление сертификатов
echo ""
echo "🔄 Обновление сертификатов..."

docker run --rm \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  --network aitu-excellence-test_aitu-network \
  certbot/certbot renew \
  --webroot \
  --webroot-path=/var/www/certbot

# Проверка успешности обновления
if [ $? -eq 0 ]; then
    echo "✅ Сертификаты успешно обновлены!"
    
    # Перезапуск nginx для применения новых сертификатов
    echo "🔄 Перезапуск nginx..."
    docker-compose -f docker-compose.prod.yml restart nginx
    
    echo "✅ Готово! Новые сертификаты применены."
    
    # Показываем новую информацию о сертификате
    echo ""
    echo "📋 Обновленная информация о сертификате:"
    openssl x509 -in certbot/conf/live/$DOMAIN/fullchain.pem -noout -dates
else
    echo "❌ Ошибка обновления сертификатов!"
    exit 1
fi
