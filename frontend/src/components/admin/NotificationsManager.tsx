// frontend/src/components/admin/NotificationsManager.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Users, 
  Bell, 
  MessageSquare, 
  Calendar, 
  Target,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Trash2,
  Filter,
  Search,
  Plus,
  Settings
} from 'lucide-react';
import { api } from '@/lib/api';
import { BroadcastModal } from './BroadcastModal';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'broadcast' | 'automated';
  target: string;
  status: 'sent' | 'pending' | 'failed';
  recipients_count: number;
  sent_at: string;
  created_by: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  title: string;
  message: string;
  type: string;
  variables: string[];
}

interface NotificationStats {
  total_sent: number;
  pending: number;
  failed: number;
  delivery_rate: number;
  open_rate: number;
}

export const NotificationsManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'broadcast' | 'templates' | 'history'>('overview');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Фильтры
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: '',
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      // Здесь загружаем данные уведомлений
      // const [notificationsData, templatesData, statsData] = await Promise.all([
      //   api.getNotificationHistory(),
      //   api.getNotificationTemplates(),
      //   api.getNotificationStats()
      // ]);
      
      // Мок данные для демонстрации
      setNotifications([
        {
          id: '1',
          title: 'Добро пожаловать в AITU!',
          message: 'Добро пожаловать в систему тестирования AITU!',
          type: 'broadcast',
          target: 'all',
          status: 'sent',
          recipients_count: 1250,
          sent_at: '2024-01-15T10:30:00Z',
          created_by: 'admin'
        },
        {
          id: '2',
          title: 'Новые тесты доступны',
          message: 'Добавлены новые тесты по программированию',
          type: 'broadcast',
          target: 'active',
          status: 'sent',
          recipients_count: 856,
          sent_at: '2024-01-14T14:20:00Z',
          created_by: 'admin'
        }
      ]);

      setTemplates([
        {
          id: '1',
          name: 'Добро пожаловать',
          title: 'Добро пожаловать в AITU!',
          message: 'Привет, {{user_name}}! Добро пожаловать в систему тестирования AITU!',
          type: 'welcome',
          variables: ['user_name']
        },
        {
          id: '2',
          name: 'Результаты теста',
          title: 'Результаты вашего теста',
          message: 'Вы прошли тест "{{test_name}}" с результатом {{score}}%',
          type: 'test_result',
          variables: ['test_name', 'score']
        }
      ]);

      setStats({
        total_sent: 15420,
        pending: 23,
        failed: 156,
        delivery_rate: 98.2,
        open_rate: 76.8
      });

    } catch (error) {
      console.error('Failed to load notifications data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBroadcast = async (data: { title: string; message: string; target: string }) => {
    try {
      await api.broadcastNotification(data);
      await loadData(); // Перезагружаем данные
    } catch (error) {
      console.error('Failed to send broadcast:', error);
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Send className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{stats.total_sent.toLocaleString()}</h3>
                <p className="text-gray-600">Отправлено</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{stats.pending}</h3>
                <p className="text-gray-600">В очереди</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{stats.delivery_rate}%</h3>
                <p className="text-gray-600">Доставлено</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{stats.open_rate}%</h3>
                <p className="text-gray-600">Открыто</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Быстрые действия */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowBroadcastModal(true)}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold">Массовая рассылка</h3>
              <p className="text-blue-100">Отправить уведомление всем пользователям</p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('templates')}
          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold">Шаблоны</h3>
              <p className="text-green-100">Управление шаблонами уведомлений</p>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('history')}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-semibold">История</h3>
              <p className="text-purple-100">Просмотр отправленных уведомлений</p>
            </div>
          </div>
        </motion.button>
      </div>

      {/* Последние уведомления */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Последние уведомления</h3>
          <button
            onClick={() => setActiveTab('history')}
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            Смотреть все
          </button>
        </div>

        <div className="space-y-3">
          {notifications.slice(0, 5).map((notification, index) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-2 h-2 rounded-full ${
                  notification.status === 'sent' ? 'bg-green-500' :
                  notification.status === 'pending' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                <div>
                  <h4 className="font-medium text-gray-800">{notification.title}</h4>
                  <p className="text-sm text-gray-600">
                    {notification.recipients_count} получателей • {new Date(notification.sent_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  notification.status === 'sent' ? 'bg-green-100 text-green-800' :
                  notification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {notification.status}
                </span>
                <button className="text-gray-400 hover:text-gray-600">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderBroadcast = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Новая рассылка</h3>
        
        <BroadcastForm onSubmit={handleBroadcast} templates={templates} />
      </div>
    </div>
  );

  const renderTemplates = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Шаблоны уведомлений</h3>
        <button
          onClick={() => setShowTemplateModal(true)}
          className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          <span>Новый шаблон</span>
        </button>
      </div>

      <div className="grid gap-4">
        {templates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-semibold text-gray-800">{template.name}</h4>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setSelectedTemplate(template);
                    setShowTemplateModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Заголовок:</div>
              <div className="text-gray-600">{template.title}</div>
            </div>
            
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Сообщение:</div>
              <div className="text-gray-600">{template.message}</div>
            </div>
            
            {template.variables.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Переменные:</div>
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((variable) => (
                    <span
                      key={variable}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Поиск по заголовку..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 w-64"
            />
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">Все статусы</option>
            <option value="sent">Отправлено</option>
            <option value="pending">В очереди</option>
            <option value="failed">Ошибка</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">Все типы</option>
            <option value="broadcast">Рассылка</option>
            <option value="system">Системные</option>
            <option value="automated">Автоматические</option>
          </select>
        </div>
      </div>

      {/* Список уведомлений */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заголовок</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Получатели</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {notifications.map((notification, index) => (
              <motion.tr
                key={notification.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-gray-50"
              >
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-gray-800">{notification.title}</div>
                    <div className="text-sm text-gray-600 truncate max-w-xs">{notification.message}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    {notification.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {notification.recipients_count.toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    notification.status === 'sent' ? 'bg-green-100 text-green-800' :
                    notification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {notification.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {new Date(notification.sent_at).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button className="text-blue-600 hover:text-blue-900">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Загрузка...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', name: 'Обзор', icon: Bell },
            { id: 'broadcast', name: 'Рассылка', icon: Send },
            { id: 'templates', name: 'Шаблоны', icon: MessageSquare },
            { id: 'history', name: 'История', icon: Calendar }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'broadcast' && renderBroadcast()}
          {activeTab === 'templates' && renderTemplates()}
          {activeTab === 'history' && renderHistory()}
        </motion.div>
      </AnimatePresence>

      {/* Modals */}
      <BroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        onSend={handleBroadcast}
      />
    </div>
  );
};

// Компонент формы рассылки
const BroadcastForm: React.FC<{
  onSubmit: (data: any) => void;
  templates: NotificationTemplate[];
}> = ({ onSubmit, templates }) => {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target: 'all',
    template: '',
    schedule: false,
    scheduleDate: '',
    scheduleTime: ''
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title,
        message: template.message,
        template: templateId
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      title: '',
      message: '',
      target: 'all',
      template: '',
      schedule: false,
      scheduleDate: '',
      scheduleTime: ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Выбор шаблона */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Шаблон (необязательно)
        </label>
        <select
          value={formData.template}
          onChange={(e) => handleTemplateSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Выбрать шаблон</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      {/* Заголовок */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Заголовок *
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Введите заголовок уведомления"
          required
        />
      </div>

      {/* Сообщение */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Сообщение *
        </label>
        <textarea
          value={formData.message}
          onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Введите текст сообщения"
          required
        />
      </div>

      {/* Получатели */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Получатели
        </label>
        <select
          value={formData.target}
          onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Все пользователи</option>
          <option value="active">Активные пользователи (30 дней)</option>
          <option value="level_5">Пользователи 5+ уровня</option>
          <option value="level_10">Пользователи 10+ уровня</option>
        </select>
      </div>

      {/* Планирование */}
      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.schedule}
            onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.checked }))}
            className="rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">Запланировать отправку</span>
        </label>

        {formData.schedule && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <input
                type="date"
                value={formData.scheduleDate}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduleDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="time"
                value={formData.scheduleTime}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Кнопки */}
      <div className="flex space-x-3 pt-4">
        <button
          type="button"
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Предпросмотр
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {formData.schedule ? 'Запланировать' : 'Отправить'}
        </button>
      </div>
    </form>
  );
};