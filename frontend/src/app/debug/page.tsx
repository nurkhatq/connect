'use client';

import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [results, setResults] = useState<any>({});
  const [telegramData, setTelegramData] = useState<any>({});
  const [buildInfo, setBuildInfo] = useState<any>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    // Получаем информацию о сборке
    setBuildInfo({
      nodeEnv: process.env.NODE_ENV,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
      botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,
      buildTime: new Date().toISOString(),
      userAgent: navigator.userAgent,
      currentUrl: window.location.href
    });

    // Проверяем Telegram WebApp
    setTelegramData({
      hasTelegram: !!window.Telegram,
      hasWebApp: !!window.Telegram?.WebApp,
      initData: window.Telegram?.WebApp?.initData || '',
      user: window.Telegram?.WebApp?.initDataUnsafe?.user || null,
      platform: window.Telegram?.WebApp?.platform || 'unknown'
    });

    // Тестируем API подключения
    const runTests = async () => {
      const tests = [
        { 
          name: 'API Ping (relative)', 
          test: () => fetch('/api/ping').then(r => r.json()) 
        },
        { 
          name: 'API Health', 
          test: () => fetch('/api/health').then(r => r.json()) 
        },
        { 
          name: 'API Tests (no auth)', 
          test: () => fetch('/api/tests').then(r => r.json()) 
        },
        { 
          name: 'API Tests (with auth)', 
          test: async () => {
            const token = localStorage.getItem('auth_token');
            const headers: any = { 'Content-Type': 'application/json' };
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            return fetch('/api/tests', { headers }).then(r => r.json());
          }
        }
      ];

      for (const { name, test } of tests) {
        try {
          const result = await test();
          setResults(prev => ({
            ...prev,
            [name]: { status: 'success', data: result }
          }));
        } catch (error: any) {
          setResults(prev => ({
            ...prev,
            [name]: { status: 'error', error: error.message }
          }));
        }
      }
    };

    runTests();
  }, [isClient]);

  const clearCacheAndReload = () => {
    if (isClient) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка debug информации...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Debug Information v3</h1>
          <button
            onClick={clearCacheAndReload}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            🗑️ Очистить кеш
          </button>
        </div>
        
        {/* Build Info */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Build Information</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(buildInfo, null, 2)}
          </pre>
        </div>

        {/* Telegram Info */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Telegram WebApp</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(telegramData, null, 2)}
          </pre>
        </div>

        {/* API Tests */}
        <div className="space-y-4">
          {Object.entries(results).map(([name, result]: [string, any]) => (
            <div key={name} className="bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">{name}</h3>
                <span className={`px-2 py-1 rounded text-sm ${
                  result.status === 'success' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {result.status}
                </span>
              </div>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(result.data || result.error, null, 2)}
              </pre>
            </div>
          ))}
        </div>

        {/* Auth Info */}
        <div className="bg-white p-4 rounded-lg shadow mt-6">
          <h2 className="text-xl font-semibold mb-4">Auth Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Auth Token:</strong> {localStorage.getItem('auth_token') ? '✅ Установлен' : '❌ Отсутствует'}</p>
            <p><strong>Token Preview:</strong> {localStorage.getItem('auth_token')?.substring(0, 20)}...</p>
          </div>
        </div>

        {/* Manual Tests */}
        <div className="bg-blue-50 p-4 rounded-lg mt-6">
          <h3 className="font-semibold text-blue-800 mb-2">Manual Tests</h3>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Tests API:</strong>{' '}
              <a 
                href="https://connect-aitu.me/api/tests" 
                target="_blank" 
                className="text-blue-600 underline"
              >
                https://connect-aitu.me/api/tests
              </a>
            </p>
            <p>
              <strong>Health API:</strong>{' '}
              <a 
                href="https://connect-aitu.me/api/health" 
                target="_blank" 
                className="text-blue-600 underline"
              >
                https://connect-aitu.me/api/health
              </a>
            </p>
            <p>
              <strong>Tests Page:</strong>{' '}
              <a 
                href="/tests" 
                className="text-blue-600 underline"
              >
                /tests
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
