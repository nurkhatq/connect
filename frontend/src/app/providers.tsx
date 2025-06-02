'use client';

import { ReactNode, useEffect, useState } from 'react';
import { telegram } from '@/lib/telegram';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Ждем инициализации Telegram WebApp
    const checkTelegram = () => {
      if (telegram.isReady()) {
        try {
          const telegramTheme = telegram.getTheme();
          setTheme(telegramTheme);
          setIsReady(true);
          console.log('✅ Providers: Telegram theme set to', telegramTheme);
        } catch (error) {
          console.warn('⚠️ Providers: Error getting theme:', error);
          setTheme('light'); // fallback
          setIsReady(true);
        }
      } else {
        // Повторяем проверку через 500ms
        setTimeout(checkTelegram, 500);
      }
    };

    checkTelegram();
  }, []);

  // Применяем тему к document
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      {children}
    </div>
  );
}
