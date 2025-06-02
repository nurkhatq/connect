'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Award, Trophy, User, Settings, LogOut } from 'lucide-react';
import { telegram } from '@/lib/telegram';
import { api } from '@/lib/api';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'achievements' | 'leaderboard'>('stats');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const initProfile = async () => {
      try {
        // Проверяем авторизацию
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.log('No auth token found, redirecting to login...');
          window.location.href = '/login';
          return;
        }

        setIsAuthorized(true);
        api.setToken(token);
        
        // Ждем инициализации Telegram
        await telegram.waitForReady();
        
        // Получаем данные пользователя из Telegram
        const telegramUser = telegram.getUser();
        setUser(telegramUser);
        
        // Загружаем данные профиля
        await loadProfileData();
        
      } catch (error) {
        console.error('Profile init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initProfile();
  }, []);

  const loadProfileData = async () => {
    try {
      const [profile, leaderboardData] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getLeaderboard().catch(() => null)
      ]);
      
      setProfileData(profile);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Failed to load profile data:', error);
    }
  };

  const handleLogout = () => {
    if (confirm('Вы уверены, что хотите выйти?')) {
      localStorage.clear();
      telegram.hapticFeedback('notification', 'success');
      window.location.href = '/login';
    }
  };

  const tabs = [
    { id: 'stats', name: 'Статистика', icon: BarChart3 },
    { id: 'achievements', name: 'Достижения', icon: Award },
    { id: 'leaderboard', name: 'Рейтинг', icon: Trophy }
  ];

  // Показываем загрузку
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  // Проверяем авторизацию после загрузки
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Доступ запрещен</h2>
          <p className="text-gray-600 mb-4">Войдите в систему для просмотра профиля</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'stats':
        return (
          <div className="space-y-6">
            {/* Quick Statistics */}
            {profileData?.statistics && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4">Общая статистика</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{profileData.statistics.total_tests || 0}</p>
                    <p className="text-sm text-gray-600">Тестов пройдено</p>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{profileData.statistics.total_points || 0}</p>
                    <p className="text-sm text-gray-600">Общие баллы</p>
                  </div>
                  
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{profileData.statistics.average_score || 0}%</p>
                    <p className="text-sm text-gray-600">Средний балл</p>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{profileData.statistics.rank || '-'}</p>
                    <p className="text-sm text-gray-600">Место в рейтинге</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Results */}
            {profileData?.recent_results?.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-green-500" />
                  Последние результаты
                </h3>
                
                <div className="space-y-3">
                  {profileData.recent_results.slice(0, 5).map((result: any, index: number) => (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          result.passed ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div>
                          <div className="text-sm font-medium text-gray-800">
                            {result.test_name || `Тест #${result.test_id?.slice(-8)}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(result.created_at).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${
                          result.passed ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {result.percentage}%
                        </div>
                        <div className="text-xs text-blue-600">
                          +{result.points_earned} баллов
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {!profileData && (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Статистика недоступна
                </h3>
                <p className="text-gray-500 mb-4">
                  Пройдите первый тест, чтобы увидеть статистику
                </p>
                <button 
                  onClick={() => window.location.href = '/tests'}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Пройти тест
                </button>
              </div>
            )}
          </div>
        );

      case 'achievements':
        return (
          <div className="space-y-4">
            {profileData?.achievements?.length > 0 ? (
              profileData.achievements.map((achievement: any, index: number) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Award className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{achievement.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{achievement.description}</p>
                      <p className="text-xs text-blue-600 mt-2">
                        Получено: {new Date(achievement.earned_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Пока нет достижений
                </h3>
                <p className="text-gray-500 mb-4">
                  Проходите тесты и выполняйте задания, чтобы получить первые достижения
                </p>
                <button 
                  onClick={() => window.location.href = '/tests'}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium"
                >
                  Пройти тест
                </button>
              </div>
            )}
          </div>
        );

      case 'leaderboard':
        return (
          <div className="space-y-4">
            {leaderboard?.length > 0 ? (
              leaderboard.slice(0, 10).map((entry: any, index: number) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
                    entry.user_id === user?.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-500 text-white' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {entry.user_id === user?.id ? 'Вы' : entry.first_name || 'Пользователь'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {entry.tests_completed} тестов пройдено
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">{entry.total_points}</p>
                      <p className="text-xs text-gray-500">баллов</p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Рейтинг недоступен
                </h3>
                <p className="text-gray-500">
                  Данные рейтинга временно недоступны
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Profile Header */}
      <div className="bg-white shadow-sm">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {user?.first_name || 'Пользователь'} {user?.last_name || ''}
                </h1>
                <p className="text-sm text-gray-600">
                  @{user?.username || `user_${user?.id}`}
                </p>
                {profileData?.statistics && (
                  <p className="text-sm text-blue-600 mt-1">
                    Уровень: {profileData.statistics.level || 'Новичок'}
                  </p>
                )}
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-2 py-4 transition-all ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  );
}
