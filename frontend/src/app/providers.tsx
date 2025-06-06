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
    // Функция для применения темы
    const applyTheme = (newTheme: 'light' | 'dark') => {
      setTheme(newTheme);
      
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        
        // Применяем CSS переменные Telegram
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          const webapp = window.Telegram.WebApp;
          const root = document.documentElement;
          
          // Устанавливаем CSS переменные на основе темы Telegram
          if (webapp.themeParams) {
            Object.entries(webapp.themeParams).forEach(([key, value]) => {
              if (typeof value === 'string') {
                root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
              }
            });
          }
        }
      }
    };

    // Ждем инициализации Telegram WebApp
    const checkTelegram = async () => {
      try {
        await telegram.waitForReady();
        
        if (telegram.isReady()) {
          const telegramTheme = telegram.getTheme();
          console.log('✅ Providers: Telegram theme detected:', telegramTheme);
          applyTheme(telegramTheme);
          setIsReady(true);
          
          // Слушаем изменения темы в Telegram
          if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
            const webapp = window.Telegram.WebApp;
            
            // Telegram может изменить тему динамически
            const originalSetTheme = webapp.setTheme || (() => {});
            webapp.setTheme = (theme: any) => {
              originalSetTheme.call(webapp, theme);
              const newTheme = theme?.colorScheme || telegram.getTheme();
              console.log('🎨 Theme changed to:', newTheme);
              applyTheme(newTheme);
            };
          }
        } else {
          // Fallback если Telegram не доступен
          console.warn('⚠️ Providers: Telegram not ready, using light theme');
          applyTheme('light');
          setIsReady(true);
        }
      } catch (error) {
        console.warn('⚠️ Providers: Error getting theme:', error);
        applyTheme('light'); // fallback
        setIsReady(true);
      }
    };

    checkTelegram();
  }, []);

  // Слушаем системные изменения темы как fallback
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (!telegram.isReady()) {
        // Используем системную тему только если Telegram недоступен
        const systemTheme = e.matches ? 'dark' : 'light';
        console.log('🌙 System theme changed to:', systemTheme);
        setTheme(systemTheme);
        
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', systemTheme);
          document.documentElement.classList.toggle('dark', systemTheme === 'dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${theme === 'dark' ? 'dark' : ''}`}>
      {children}
    </div>
  );
}