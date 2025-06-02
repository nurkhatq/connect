'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, FileText, User, Bell, Award, TrendingUp } from 'lucide-react';
import { telegram } from '@/lib/telegram';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const initDashboard = async () => {
      try {
        // Проверяем авторизацию
        const token = localStorage.getItem('auth_token');
        if (!token) {
          window.location.href = '/login';
          return;
        }

        setIsAuthorized(true);
        api.setToken(token);
        
        // Ждем инициализации Telegram
        await telegram.waitForReady();
        
        // Получаем данные пользователя
        const telegramUser = telegram.getUser();
        setUser(telegramUser);
        
        // Загружаем статистику
        try {
          const profileData = await api.getProfile();
          setStats(profileData.statistics);
        } catch (err) {
          console.log('Статистика недоступна:', err);
        }
        
      } catch (error) {
        console.error('Dashboard init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []);

  const navigateTo = (path: string) => {
    telegram.hapticFeedback('impact', 'light');
    window.location.href = path;
  };

  // Показываем загрузку пока проверяем авторизацию
  if (loading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">
            {!isAuthorized ? 'Проверка авторизации...' : 'Загрузка дашборда...'}
          </p>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      title: 'Тесты',
      description: 'Пройти тестирование',
      icon: BookOpen,
      path: '/tests',
      color: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Заявка',
      description: 'Подача документов',
      icon: FileText,
      path: '/application',
      color: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100 text-green-600'
    },
    {
      title: 'Профиль',
      description: 'Личная информация',
      icon: User,
      path: '/profile',
      color: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Уведомления',
      description: 'Важные сообщения',
      icon: Bell,
      path: '/notifications',
      color: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-100 text-orange-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="p-6">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Добро пожаловать, {user?.first_name || 'Пользователь'}!
              </h1>
              <p className="text-gray-600 mt-1">
                AITU Excellence Test
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-xl">👤</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.total_tests || 0}</p>
                  <p className="text-sm text-gray-600">Тестов пройдено</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{stats.total_points || 0}</p>
                  <p className="text-sm text-gray-600">Общие баллы</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Быстрые действия</h2>
        
        <div className="grid grid-cols-1 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => navigateTo(action.path)}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${action.iconBg}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{action.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                  </div>
                  
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Welcome Message */}
      <div className="p-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">🎉 Добро пожаловать в AITU!</h3>
          <p className="text-blue-100 mb-4">
            Пройдите тестирование и подайте заявку на поступление в Астана IT Университет.
          </p>
          
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
              🎯 Excellence Test
            </span>
            <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
              📱 Telegram App
            </span>
            <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm">
              ✨ Ready to Go
            </span>
          </div>
        </div>
      </div>

      {/* Bottom spacing for navigation */}
      <div className="h-20"></div>
    </div>
  );
}
