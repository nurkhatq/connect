'use client';

import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [results, setResults] = useState<any>({});
  const [telegramData, setTelegramData] = useState<any>({});

  useEffect(() => {
    // Проверяем Telegram WebApp
    if (typeof window !== 'undefined') {
      setTelegramData({
        hasTelegram: !!window.Telegram,
        hasWebApp: !!window.Telegram?.WebApp,
        initData: window.Telegram?.WebApp?.initData || '',
        user: window.Telegram?.WebApp?.initDataUnsafe?.user || null,
        platform: window.Telegram?.WebApp?.platform || 'unknown'
      });
    }

    // Тестируем API подключения
    const runTests = async () => {
      const tests = [
        { 
          name: 'API Base URL', 
          test: () => Promise.resolve({ 
            url: process.env.NEXT_PUBLIC_API_URL || 'не установлен',
            current_origin: window.location.origin 
          })
        },
        { 
          name: 'API Ping (relative)', 
          test: () => fetch('/api/ping').then(r => r.json()) 
        },
        { 
          name: 'API Ping (absolute)', 
          test: () => fetch('https://connect-aitu.me/api/ping').then(r => r.json()) 
        },
        { 
          name: 'API Health', 
          test: () => fetch('/api/health').then(r => r.json()) 
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
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Debug Information</h1>
        
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
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(result.data || result.error, null, 2)}
              </pre>
            </div>
          ))}
        </div>

        {/* Manual Tests */}
        <div className="bg-blue-50 p-4 rounded-lg mt-6">
          <h3 className="font-semibold text-blue-800 mb-2">Manual Tests</h3>
          <div className="space-y-2 text-sm">
            <p>
              <strong>Direct API:</strong>{' '}
              <a 
                href="https://connect-aitu.me/api/ping" 
                target="_blank" 
                className="text-blue-600 underline"
              >
                https://connect-aitu.me/api/ping
              </a>
            </p>
            <p>
              <strong>Health Check:</strong>{' '}
              <a 
                href="https://connect-aitu.me/api/health" 
                target="_blank" 
                className="text-blue-600 underline"
              >
                https://connect-aitu.me/api/health
              </a>
            </p>
            <p><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'SSR'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
