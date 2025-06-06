'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { telegram } from '@/lib/telegram';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [status, setStatus] = useState('Инициализация...');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [retryCount, setRetryCount] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const updateDebugInfo = (info: any) => {
    setDebugInfo(prev => ({ ...prev, ...info }));
  };

  const checkExistingAuth = useCallback(() => {
    if (!isClient) return false;
    
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        // Проверяем не истек ли токен
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
        
        if (isExpired) {
          console.log('🔄 Token expired, clearing...');
          localStorage.removeItem('auth_token');
          return false;
        }
        
        setStatus('Токен найден, проверяем валидность...');
        return true;
      } catch (error) {
        console.log('🔄 Invalid token, clearing...');
        localStorage.removeItem('auth_token');
        return false;
      }
    }
    return false;
  }, [isClient]);

  const validateExistingToken = async () => {
    try {
      const profile = await api.getProfile();
      if (profile) {
        setStatus('Авторизация действительна! Перенаправление...');
        updateDebugInfo({ tokenValid: true });
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
        return true;
      }
    } catch (error) {
      console.log('🔄 Token validation failed, need re-login');
      localStorage.removeItem('auth_token');
      return false;
    }
    return false;
  };

  const testApiConnection = async () => {
    try {
      setStatus('Тестирование API соединения...');
      const result = await api.ping();
      updateDebugInfo({ apiTest: 'success', apiResult: result });
      return true;
    } catch (error: any) {
      updateDebugInfo({ apiTest: 'failed', apiError: error.message });
      setError(`API недоступен: ${error.message}`);
      return false;
    }
  };

  const handleLogin = useCallback(async (initData: string, user: any) => {
    try {
      setStatus('Проверка API...');
      const apiOk = await testApiConnection();
      if (!apiOk) return;

      setStatus('Авторизация через Telegram...');
      updateDebugInfo({ 
        loginAttempt: true, 
        userInfo: user,
        initDataLength: initData.length 
      });
      
      const response = await api.login(initData);
      
      if (response && response.access_token) {
        api.setToken(response.access_token);
        updateDebugInfo({ loginSuccess: true, user: response.user });
        
        setStatus('Успешно! Перенаправление...');
        telegram.hapticFeedback('notification', 'success');
        
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        throw new Error('Invalid response from server');
      }
      
    } catch (err: any) {
      console.error('❌ Ошибка авторизации:', err);
      updateDebugInfo({ loginError: err.message, attempt: retryCount + 1 });
      
      if (retryCount < 2) {
        setStatus(`Ошибка авторизации. Попытка ${retryCount + 2}/3...`);
        setRetryCount(prev => prev + 1);
        // Повторная попытка через 2 секунды
        setTimeout(() => handleLogin(initData, user), 2000);
      } else {
        setError(`Ошибка авторизации (${retryCount + 1} попыток): ${err.message}`);
        setIsLoading(false);
      }
    }
  }, [retryCount]);

  useEffect(() => {
    if (!isClient) return;

    const initializeApp = async () => {
      try {
        updateDebugInfo({ 
          startTime: new Date().toISOString(),
          currentUrl: window.location.href,
          userAgent: navigator.userAgent,
          apiBaseUrl: process.env.NEXT_PUBLIC_API_URL
        });

        // Проверяем существующую авторизацию
        if (checkExistingAuth()) {
          const isValid = await validateExistingToken();
          if (isValid) return;
        }

        setStatus('Подключение к Telegram...');
        await telegram.waitForReady();
        
        setStatus('Получение данных пользователя...');
        const initData = telegram.getInitData();
        const user = telegram.getUser();
        
        updateDebugInfo({
          telegramReady: true,
          initDataLength: initData?.length || 0,
          hasUser: !!user,
          platform: telegram.getPlatform(),
          telegramUser: user
        });
        
        if (initData && initData.length > 0 && user) {
          setStatus('Данные получены, авторизация...');
          await handleLogin(initData, user);
        } else {
          setStatus('Ошибка получения данных Telegram');
          setError('Приложение должно быть открыто через Telegram Bot');
          updateDebugInfo({ telegramDataMissing: true });
          setIsLoading(false);
        }
        
      } catch (err: any) {
        console.error('❌ Ошибка инициализации:', err);
        setStatus('Ошибка инициализации');
        setError(err.message || 'Не удалось инициализировать приложение');
        updateDebugInfo({ initError: err.message });
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(initializeApp, 500);
    return () => clearTimeout(timeoutId);
  }, [isClient, handleLogin, checkExistingAuth]);

  const retry = () => {
    setError('');
    setIsLoading(true);
    setStatus('Повторная попытка...');
    setDebugInfo({});
    setRetryCount(0);
    localStorage.removeItem('auth_token');
    window.location.reload();
  };

  const forceLogin = async () => {
    setError('');
    setIsLoading(true);
    setStatus('Принудительная авторизация...');
    setRetryCount(0);
    localStorage.removeItem('auth_token');
    
    try {
      await telegram.waitForReady();
      const initData = telegram.getInitData();
      const user = telegram.getUser();
      
      if (initData && user) {
        await handleLogin(initData, user);
      } else {
        setError('Не удалось получить данные Telegram');
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(`Ошибка принудительной авторизации: ${err.message}`);
      setIsLoading(false);
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

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
            
            {retryCount > 0 && (
              <p className="text-sm text-orange-600 mb-2">
                Попытка {retryCount + 1} из 3
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700 text-sm mb-3">{error}</p>
              <div className="space-y-2">
                <button
                  onClick={retry}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Попробовать снова
                </button>
                <button
                  onClick={forceLogin}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Принудительная авторизация
                </button>
              </div>
            </div>
          )}

          {/* Success indicators */}
          {!error && !isLoading && (
            <div className="text-center">
              <div className="text-green-500 text-2xl mb-2">✅</div>
              <p className="text-green-700 font-medium">Готово!</p>
            </div>
          )}
        </div>

        {/* Debug Info */}
        {Object.keys(debugInfo).length > 0 && (
          <details className="bg-white rounded-lg p-4 shadow mb-4">
            <summary className="text-sm text-gray-500 cursor-pointer mb-2">
              Debug информация ({Object.keys(debugInfo).length} элементов)
            </summary>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}

        {/* Quick Links */}
        <div className="text-center space-y-2">
          <a 
            href="/debug" 
            className="block text-blue-600 hover:text-blue-700 text-sm"
          >
            🔍 Debug страница
          </a>
          <a 
            href="/token-test" 
            className="block text-blue-600 hover:text-blue-700 text-sm"
          >
            🧪 Тест токена
          </a>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Астана IT Университет - Система тестирования
          </p>
          <p className="text-xs text-gray-400 mt-1">
            v2.0 - Production Ready
          </p>
        </div>
      </motion.div>
    </div>
  );
}
