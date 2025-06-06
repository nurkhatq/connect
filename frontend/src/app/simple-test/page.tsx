'use client';

import { useState, useEffect } from 'react';

export default function SimpleTestPage() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Проверяем что мы на клиенте
  useEffect(() => {
    setIsClient(true);
  }, []);

  const testApi = async (endpoint: string) => {
    setLoading(true);
    setResult('Загрузка...');
    
    try {
      console.log(`🧪 Testing: ${endpoint}`);
      
      const response = await fetch(endpoint);
      console.log(`📡 Status: ${response.status}`);
      console.log(`📡 Headers:`, Object.fromEntries(response.headers.entries()));
      
      const text = await response.text();
      console.log(`📋 Response:`, text);
      
      setResult(`Status: ${response.status}\n\nResponse:\n${text}`);
    } catch (error: any) {
      console.error('❌ Error:', error);
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testWithAuth = async () => {
    setLoading(true);
    setResult('Загрузка с авторизацией...');
    
    try {
      // Безопасная проверка localStorage
      const token = isClient ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setResult('❌ Токен не найден! Сначала войдите в систему.');
        return;
      }

      const response = await fetch('/api/tests', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📡 Auth Status: ${response.status}`);
      const text = await response.text();
      console.log(`📋 Auth Response:`, text);
      
      setResult(`Status: ${response.status}\n\nResponse:\n${text}`);
    } catch (error: any) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Показываем загрузку пока не на клиенте
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Simple API Test</h1>
        
        <div className="space-y-4 mb-6">
          <button
            onClick={() => testApi('/api/ping')}
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white p-3 rounded"
          >
            Test /api/ping
          </button>
          
          <button
            onClick={() => testApi('/api/health')}
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white p-3 rounded"
          >
            Test /api/health
          </button>
          
          <button
            onClick={() => testApi('/api/tests')}
            disabled={loading}
            className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white p-3 rounded"
          >
            Test /api/tests (no auth)
          </button>
          
          <button
            onClick={testWithAuth}
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white p-3 rounded"
          >
            Test /api/tests (with auth)
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Result:</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto whitespace-pre-wrap">
            {result || 'Нажмите кнопку для тестирования'}
          </pre>
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-600">
            Auth Token: {isClient && localStorage.getItem('auth_token') ? '✅ Установлен' : '❌ Отсутствует'}
          </p>
          <div className="space-x-4">
            <a href="/login" className="text-blue-600 hover:underline">Login</a>
            <a href="/debug" className="text-blue-600 hover:underline">Debug</a>
            <a href="/tests" className="text-blue-600 hover:underline">Tests Page</a>
          </div>
        </div>
      </div>
    </div>
  );
}
