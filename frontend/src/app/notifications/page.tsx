'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import Navigation from '@/components/Navigation';
import NotificationCard from '@/components/NotificationCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { telegram } from '@/lib/telegram';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const { setNotifications: setStoreNotifications } = useAppStore();

  const notificationTypes = [
    { id: 'all', name: 'Все', icon: '📋' },
    { id: 'test_result', name: 'Тесты', icon: '📝' },
    { id: 'application_status', name: 'Заявки', icon: '📄' },
    { id: 'achievement', name: 'Достижения', icon: '🏆' },
    { id: 'reminder', name: 'Напоминания', icon: '⏰' }
  ];

  const loadNotifications = useCallback(async () => {
    try {
      const notificationsData = await api.getNotifications();
      setNotifications(notificationsData);
      setStoreNotifications(notificationsData);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [setStoreNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter((n: any) => n.type === filter);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.markNotificationRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      telegram.hapticFeedback('impact', 'light');
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (isMarkingAllRead) return;
    
    setIsMarkingAllRead(true);
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(unreadNotifications.map(n => api.markNotificationRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      telegram.hapticFeedback('notification', 'success');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      telegram.hapticFeedback('notification', 'error');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Уведомления</h1>
              <p className="opacity-90">
                {unreadCount > 0 ? `${unreadCount} непрочитанных` : 'Все прочитано'}
              </p>
            </div>
            {unreadCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={markAllAsRead}
                disabled={isMarkingAllRead}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {isMarkingAllRead ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                <span>Все прочитано</span>
              </motion.button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {notificationTypes.map((type) => (
              <motion.button
                key={type.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setFilter(type.id);
                  telegram.hapticFeedback('selection');
                }}
                className={`flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                  filter === type.id
                    ? 'bg-white text-purple-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <span>{type.icon}</span>
                <span className="text-sm font-medium">{type.name}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Notifications List */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" text="Загрузка уведомлений..." />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-8 text-center shadow-sm"
          >
            <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {filter === 'all' ? 'Нет уведомлений' : 'Нет уведомлений в этой категории'}
            </h3>
            <p className="text-gray-500 mb-4">
              {filter === 'all' 
                ? 'Когда появятся новые уведомления, они будут показаны здесь'
                : 'Попробуйте выбрать другую категорию'
              }
            </p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Показать все
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification, index) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                index={index}
                onMarkRead={markAsRead}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {filteredNotifications.length >= 20 && (
          <div className="text-center mt-6">
            <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors">
              Загрузить еще
            </button>
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
}