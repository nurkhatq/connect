'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { telegram } from '@/lib/telegram';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [status, setStatus] = useState('Инициализация...');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Проверяем есть ли уже токен
  const checkExistingAuth = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        setStatus('Уже авторизован! Перенаправление...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
        return true;
      }
    }
    return false;
  };

  const handleLogin = useCallback(async (initData: string, user: any) => {
    try {
      setStatus('Авторизация...');
      
      const response = await api.login(initData);
      
      // Сохраняем токен
      api.setToken(response.access_token);
      
      setStatus('Успешно! Перенаправление...');
      telegram.hapticFeedback('notification', 'success');
      
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
      
    } catch (err: any) {
      console.error('Ошибка авторизации:', err);
      setError(`Ошибка авторизации: ${err.message}`);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Сначала проверяем существующую авторизацию
        if (checkExistingAuth()) {
          return;
        }

        setStatus('Подключение к Telegram...');
        await telegram.waitForReady();
        
        setStatus('Получение данных пользователя...');
        const initData = telegram.getInitData();
        const user = telegram.getUser();
        
        if (initData && initData.length > 0 && user) {
          setStatus('Данные получены, авторизация...');
          await handleLogin(initData, user);
        } else {
          setStatus('Ошибка получения данных');
          setError('Приложение должно быть открыто через Telegram Bot');
          setIsLoading(false);
        }
        
      } catch (err: any) {
        console.error('Ошибка инициализации:', err);
        setStatus('Ошибка инициализации');
        setError(err.message || 'Не удалось инициализировать приложение');
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(initializeApp, 500);
    return () => clearTimeout(timeoutId);
  }, [handleLogin]);

  const retry = () => {
    setError('');
    setIsLoading(true);
    setStatus('Повторная попытка...');
    localStorage.removeItem('auth_token');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-blue-500 rounded-full mb-4 shadow-lg"
          >
            <span className="text-3xl">🎓</span>
          </motion.div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            AITU Excellence Test
          </h1>
          
          <p className="text-gray-600">
            Система тестирования AITU
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <div className="text-center">
            {isLoading && (
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            )}
            
            <p className="text-lg font-medium text-gray-700 mb-4">
              {status}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-sm mb-3">{error}</p>
              <button
                onClick={retry}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Попробовать снова
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Астана IT Университет - Система тестирования
          </p>
        </div>
      </motion.div>
    </div>
  );
}
