'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-md w-full">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Произошла ошибка
        </h2>
        
        <p className="text-gray-600 mb-6">
          Что-то пошло не так. Попробуйте обновить страницу или вернуться на главную.
        </p>

        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Попробовать снова</span>
          </button>

          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>На главную</span>
          </button>
        </div>

        {error.digest && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">
              Код ошибки: {error.digest}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}