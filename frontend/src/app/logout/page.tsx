'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, CheckCircle } from 'lucide-react';
import { telegram } from '@/lib/telegram';
import { authManager } from '@/lib/auth';

export default function LogoutPage() {
  const [countdown, setCountdown] = useState(3);
  const [isClosing, setIsClosing] = useState(false);
  const [logoutComplete, setLogoutComplete] = useState(false);

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Останавливаем таймер обновления токенов
        authManager.stopTokenRefreshTimer();
        
        // Очищаем данные через ваш AuthManager
        localStorage.removeItem('auth_token');
        sessionStorage.clear();
        
        // Haptic feedback
        telegram.hapticFeedback('notification', 'success');
        
        setLogoutComplete(true);
        
        // Запускаем обратный отсчет
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              setIsClosing(true);
              
              // Решаем что делать дальше
              setTimeout(() => {
                // Проверяем можем ли закрыть приложение
                if (telegram.isReady() && window.Telegram?.WebApp?.close) {
                  telegram.close();
                } else {
                  // Fallback на login страницу
                  window.location.href = '/login';
                }
              }, 500);
              
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Очистка таймера при размонтировании
        return () => clearInterval(timer);
        
      } catch (error) {
        console.error('Logout error:', error);
        // В случае ошибки принудительно перенаправляем
        window.location.href = '/login';
      }
    };

    performLogout();
  }, []);

  const handleCloseNow = () => {
    setIsClosing(true);
    telegram.hapticFeedback('impact', 'medium');
    
    setTimeout(() => {
      if (telegram.isReady() && window.Telegram?.WebApp?.close) {
        telegram.close();
      } else {
        window.location.href = '/login';
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        {/* Success Card */}
        <div className="bg-white rounded-xl p-8 shadow-lg text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6"
          >
            <CheckCircle className="w-10 h-10 text-green-600" />
          </motion.div>
          
          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold text-gray-800 mb-2"
          >
            Вы успешно вышли
          </motion.h1>
          
          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-gray-600 mb-6"
          >
            {logoutComplete ? 'Все данные очищены.' : 'Выполняется выход...'}
          </motion.p>
          
          {/* Countdown */}
          {logoutComplete && !isClosing ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mb-6"
            >
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-blue-800 font-medium mb-2">
                  Перенаправление через:
                </p>
                <div className="text-3xl font-bold text-blue-600">
                  {countdown}
                </div>
              </div>
              
              <button
                onClick={handleCloseNow}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Перейти сейчас
              </button>
            </motion.div>
          ) : isClosing ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <div className="bg-green-50 rounded-lg p-4">
                <LogOut className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-green-800 font-medium">
                  Перенаправление...
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6"
            >
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-2"></div>
                <p className="text-yellow-800 font-medium">
                  Выполняется выход...
                </p>
              </div>
            </motion.div>
          )}
          
          {/* Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-sm text-gray-500"
          >
            <p>AITU Excellence Test</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
