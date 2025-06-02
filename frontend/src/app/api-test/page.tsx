'use client';

import { useState, useEffect } from 'react';
import { debugApi } from '@/lib/api-debug';
import { telegram } from '@/lib/telegram';

export default function ApiTestPage() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [telegramData, setTelegramData] = useState<any>({});

  useEffect(() => {
    const loadTelegramData = async () => {
      await telegram.waitForReady();
      
      const initData = telegram.getInitData();
      const user = telegram.getUser();
      
      setTelegramData({
        hasInitData: !!initData,
        initDataLength: initData?.length || 0,
        hasUser: !!user,
        user: user ? {
          id: user.id,
          first_name: user.first_name,
          username: user.username
        } : null,
        rawInitData: initData?.substring(0, 200) + '...'
      });
    };

    loadTelegramData();
  }, []);

  const testPing = async () => {
    setLoading(true);
    try {
      const response = await debugApi.ping();
      setResult(`✅ Ping Success: ${JSON.stringify(response, null, 2)}`);
    } catch (error) {
      setResult(`❌ Ping Error: ${error}`);
    }
    setLoading(false);
  };

  const testAuth = async () => {
    setLoading(true);
    try {
      const response = await debugApi.testLoginWithRealData();
      setResult(`✅ Auth Success: ${JSON.stringify(response, null, 2)}`);
    } catch (error) {
      setResult(`❌ Auth Error: ${error}`);
    }
    setLoading(false);
  };

  const testEndpoints = async () => {
    setLoading(true);
    setResult('Testing all endpoints...\n\n');
    
    const endpoints = [
      '/ping',
      '/health', 
      '/auth/login',
      '/docs'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`https://connect-aitu.me/api${endpoint}`, {
          method: endpoint === '/auth/login' ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: endpoint === '/auth/login' ? JSON.stringify({ init_data: 'test' }) : undefined
        });
        
        setResult(prev => prev + `${endpoint}: ${response.status} ${response.statusText}\n`);
      } catch (error) {
        setResult(prev => prev + `${endpoint}: ERROR - ${error}\n`);
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">🔧 API Test Page</h1>
      
      {/* Telegram Data Info */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <h3 className="font-bold text-blue-700 mb-2">📱 Telegram Data:</h3>
        <div className="text-sm text-blue-600 space-y-1">
          <div>Has InitData: {telegramData.hasInitData ? '✅' : '❌'}</div>
          <div>InitData Length: {telegramData.initDataLength}</div>
          <div>Has User: {telegramData.hasUser ? '✅' : '❌'}</div>
          {telegramData.user && (
            <div>User: {telegramData.user.first_name} (ID: {telegramData.user.id})</div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          onClick={testPing}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '⏳' : '🧪'} Test Ping
        </button>
        
        <button
          onClick={testAuth}
          disabled={loading}
          className="bg-green-500 text-white px-6 py-3 rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '⏳' : '🔐'} Test Real Auth
        </button>
        
        <button
          onClick={testEndpoints}
          disabled={loading}
          className="bg-purple-500 text-white px-6 py-3 rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? '⏳' : '📋'} Test All Endpoints
        </button>
      </div>
      
      <div className="bg-white rounded-lg p-6 shadow">
        <h3 className="font-bold mb-4">📊 Результат:</h3>
        <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto max-h-96 whitespace-pre-wrap">
          {result || 'Нажмите кнопку для тестирования'}
        </pre>
      </div>
      
      <div className="mt-6 text-center space-x-4">
        <a href="/login" className="text-blue-500 hover:underline">
          ← Назад к логину
        </a>
        <a href="/dashboard" className="text-green-500 hover:underline">
          Dashboard →
        </a>
      </div>
    </div>
  );
}
