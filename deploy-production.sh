
# Установка прав доступа
echo "🔒 Setting permissions..."
chown -R aitu:aitu $APP_DIR
chmod 755 backend/uploads
chmod 644 backend/data/*.json
chmod 600 .env

# Создание systemd сервиса для автозапуска
echo "⚙️ Creating systemd service..."
cat > /etc/systemd/system/aitu-excellence-test.service << EOF
[Unit]
Description=AITU Excellence Test Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl enable aitu-excellence-test.service

# Настройка логротации
echo "📝 Setting up log rotation..."
cat > /etc/logrotate.d/aitu << EOF
$APP_DIR/nginx/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        docker-compose -f $APP_DIR/docker-compose.prod.yml exec nginx nginx -s reload
    endscript
}
EOF

# Настройка бэкапов
echo "💾 Setting up automated backups..."
cat > /etc/cron.d/aitu-backup << EOF
# Daily database backup at 2 AM
0 2 * * * root cd $APP_DIR && docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U aitu_user aitu_db | gzip > $BACKUP_DIR/db-backup-\$(date +\%Y\%m\%d-\%H\%M\%S).sql.gz

# Weekly cleanup of old backups (keep 30 days)
0 3 * * 0 root find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

# Fail2ban конфигурация
echo "🛡️ Setting up fail2ban..."
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
EOF

systemctl enable fail2ban
systemctl start fail2ban

# Сборка и запуск приложения
echo "🏗️ Building and starting application..."
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Ожидание запуска сервисов
echo "⏳ Waiting for services to start..."
sleep 30

# Инициализация базы данных
echo "🗄️ Initializing database..."
docker-compose -f docker-compose.prod.yml exec -T backend python -c "
import asyncio
from database import init_db
from main import load_test_data

async def init():
    await init_db()
    await load_test_data()
    print('✅ Database and test data initialized')

asyncio.run(init())
"

# Получение SSL сертификата
echo "🔒 Obtaining SSL certificate..."
docker-compose -f docker-compose.prod.yml run --rm certbot

# Перезапуск nginx с SSL
docker-compose -f docker-compose.prod.yml restart nginx

# Настройка автообновления SSL
echo "🔄 Setting up SSL auto-renewal..."
cat > /etc/cron.d/certbot-renew << EOF
0 12 * * * root cd $APP_DIR && docker-compose -f docker-compose.prod.yml run --rm certbot renew --quiet && docker-compose -f docker-compose.prod.yml restart nginx
EOF

# Финальная проверка
echo "🔍 Performing final health check..."
sleep 10

if curl -f https://$DOMAIN/health > /dev/null 2>&1; then
    echo ""
    echo "🎉 =================================="
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "🌐 Application: https://$DOMAIN"
    echo "📊 API Docs: https://$DOMAIN/api/docs"
    echo "🔍 Health: https://$DOMAIN/health"
    echo "===================================="
    echo ""
    echo "📋 Next steps:"
    echo "1. Configure Telegram bot webhook:"
    echo "   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://$DOMAIN/webhook"
    echo ""
    echo "2. Monitor logs:"
    echo "   docker-compose -f docker-compose.prod.yml logs -f"
    echo ""
    echo "3. Backup verification:"
    echo "   ls -la $BACKUP_DIR"
    echo ""
    echo "🔒 Security features enabled:"
    echo "• UFW Firewall (ports 22, 80, 443)"
    echo "• Fail2ban protection"
    echo "• SSL certificates with auto-renewal"
    echo "• Rate limiting on API endpoints"
    echo "• Security headers configured"
else
    echo "❌ Health check failed. Check logs:"
    echo "   docker-compose -f docker-compose.prod.yml logs"
fi
```

## Команды для запуска production

### 1. Подготовьте сервер:
```bash
# Скачайте скрипт деплоя
wget https://raw.githubusercontent.com/your-repo/deploy-production.sh
chmod +x deploy-production.sh

# Запустите deployment
sudo ./deploy-production.sh
```

### 2. Настройте DNS:
```
A Record: connect-aitu.me -> YOUR_SERVER_IP
A Record: www.connect-aitu.me -> YOUR_SERVER_IP
```

### 3. Настройте Telegram Webhook:
```bash
# После успешного запуска выполните:
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://connect-aitu.me/webhook"
```

Теперь у вас будет полноценный production deployment с:
- ✅ SSL сертификатами
- ✅ Автоматическими бэкапами  
- ✅ Security настройками
- ✅ Мониторингом и логами
- ✅ Автозапуском сервисов

Готово для production использования на connect-aitu.me! 