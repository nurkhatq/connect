'use client';

import { useState, useEffect } from 'react';

export default function TokenTestPage() {
  const [tokenInfo, setTokenInfo] = useState<any>({});
  const [testResults, setTestResults] = useState<any>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        // Парсим JWT токен (без проверки подписи)
        const parts = token.split('.');
        if (parts.length === 3) {
          const header = JSON.parse(atob(parts[0]));
          const payload = JSON.parse(atob(parts[1]));
          
          setTokenInfo({
            token: token.substring(0, 50) + '...',
            header,
            payload,
            isExpired: payload.exp ? Date.now() / 1000 > payload.exp : false,
            expiresAt: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'Unknown'
          });
        }
      } catch (error) {
        setTokenInfo({ error: 'Invalid JWT format' });
      }
    } else {
      setTokenInfo({ error: 'No token found' });
    }
  }, [isClient]);

  const testTokenWithAPI = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setTestResults({ error: 'No token' });
      return;
    }

    const tests = [
      { name: 'Auth Me', endpoint: '/api/auth/me' },
      { name: 'Users Profile', endpoint: '/api/users/profile' },
      { name: 'Tests', endpoint: '/api/tests' }
    ];

    const results: any = {};

    for (const test of tests) {
      try {
        const response = await fetch(test.endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }

        results[test.name] = {
          status: response.status,
          ok: response.ok,
          data: data
        };
      } catch (error: any) {
        results[test.name] = {
          status: 'error',
          error: error.message
        };
      }
    }

    setTestResults(results);
  };

  const reLogin = async () => {
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) {
        alert('No Telegram data available');
        return;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: initData })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth_token', data.access_token);
        alert('✅ Re-login successful! Refresh the page.');
        window.location.reload();
      } else {
        const error = await response.text();
        alert(`❌ Re-login failed: ${error}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  if (!isClient) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Token Analysis & Test</h1>

        {/* Token Info */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Token Information</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(tokenInfo, null, 2)}
          </pre>
        </div>

        {/* Controls */}
        <div className="space-y-4 mb-6">
          <button
            onClick={testTokenWithAPI}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg"
          >
            🧪 Test Token with API
          </button>
          
          <button
            onClick={reLogin}
            className="w-full bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg"
          >
            🔄 Re-Login with Telegram
          </button>
          
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-lg"
          >
            🗑️ Clear All & Reload
          </button>
        </div>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">API Test Results</h2>
            <div className="space-y-4">
              {Object.entries(testResults).map(([name, result]: [string, any]) => (
                <div key={name} className="border border-gray-200 rounded p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">{name}</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      result.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 text-center space-x-4">
          <a href="/debug" className="text-blue-600 hover:underline">← Back to Debug</a>
          <a href="/login" className="text-blue-600 hover:underline">Login Page</a>
          <a href="/tests" className="text-blue-600 hover:underline">Tests Page</a>
        </div>
      </div>
    </div>
  );
}
