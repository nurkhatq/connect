'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { telegram } from '@/lib/telegram';

interface NotificationCardProps {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    data?: any;
    created_at: string;
  };
  index: number;
  onMarkRead: (id: string) => void;
}

export default function NotificationCard({ notification, index, onMarkRead }: NotificationCardProps) {
  const getNotificationIcon = (type: string) => {
    const icons = {
      test_result: '📝',
      application_status: '📄',
      achievement: '🏆',
      reminder: '⏰'
    };
    return icons[type as keyof typeof icons] || '📋';
  };

  const getNotificationColor = (type: string) => {
    const colors = {
      test_result: 'from-blue-500 to-blue-600',
      application_status: 'from-green-500 to-green-600',
      achievement: 'from-purple-500 to-purple-600',
      reminder: 'from-yellow-500 to-yellow-600'
    };
    return colors[type as keyof typeof colors] || 'from-gray-500 to-gray-600';
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
      telegram.hapticFeedback('impact', 'light');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={handleClick}
      className={`bg-white rounded-xl p-4 shadow-sm border cursor-pointer transition-all ${
        notification.read 
          ? 'border-gray-100' 
          : 'border-blue-200 bg-blue-50/50'
      }`}
    >
      <div className="flex items-start space-x-4">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getNotificationColor(notification.type)} flex items-center justify-center text-white text-lg flex-shrink-0`}>
          {getNotificationIcon(notification.type)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className={`font-semibold ${notification.read ? 'text-gray-800' : 'text-blue-800'}`}>
              {notification.title}
            </h3>
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
            )}
          </div>
          
          <p className={`text-sm mb-3 ${notification.read ? 'text-gray-600' : 'text-gray-700'}`}>
            {notification.message}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {new Date(notification.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            
            {notification.read && (
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Check className="w-3 h-3" />
                <span>Прочитано</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Data */}
      {notification.data && Object.keys(notification.data).length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {notification.type === 'test_result' && notification.data.score && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Результат:</span>
              <span className={`font-medium ${
                notification.data.passed ? 'text-green-600' : 'text-red-600'
              }`}>
                {notification.data.score}% 
                {notification.data.points_earned && ` (+${notification.data.points_earned} баллов)`}
              </span>
            </div>
          )}
          
          {notification.type === 'achievement' && notification.data.points && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Награда:</span>
              <span className="font-medium text-purple-600">
                +{notification.data.points} баллов
              </span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}