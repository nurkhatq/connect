'use client';

import Script from 'next/script';

export default function TelegramScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="beforeInteractive"
      onLoad={() => {
        console.log('✅ Telegram WebApp SDK loaded');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('telegram-web-app-loaded'));
        }
      }}
      onError={() => {
        console.error('❌ Failed to load Telegram WebApp SDK');
      }}
    />
  );
}
