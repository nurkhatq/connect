'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Страница не найдена
          </h2>
          <p className="text-gray-600 mb-8">
            Извините, запрашиваемая страница не существует.
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/dashboard">
            <button className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium mx-auto transition-colors">
              <Home className="w-4 h-4" />
              <span>На главную</span>
            </button>
          </Link>

          <button
            onClick={() => window.history.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mx-auto transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Назад</span>
          </button>
        </div>
      </div>
    </div>
  );
}