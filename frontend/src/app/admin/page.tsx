'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import { 
  Users, FileText, BarChart3, Settings, Download, Upload, Search, Filter,
  Calendar, TrendingUp, AlertCircle, CheckCircle, Clock, XCircle,
  Eye, Edit, Trash2, RefreshCw, Send, Plus, ChevronDown, ChevronRight,
  Globe, Shield, Database, Activity, Bell, Zap, AlertTriangle, MessageSquare
} from 'lucide-react';
import { api } from '@/lib/api';
import { telegram } from '@/lib/telegram';

// 🔥 ТИПЫ
interface DashboardStats {
  summary: {
    total_users: number;
    total_applications: number;
    total_tests: number;
    active_users: number;
  };
  period_stats: {
    new_users: number;
    new_applications: number;
    tests_taken: number;
    active_users: number;
  };
  applications_by_status: Record<string, number>;
  tests_analytics: Array<{
    category: string;
    attempts: number;
    avg_score: number;
    passed: number;
    pass_rate: number;
  }>;
  chart_data: Array<{
    date: string;
    tests: number;
    users: number;
    applications: number;
  }>;
}

interface Application {
  id: string;
  application_number: string;
  status: string;
  personal_data: any;
  education: any;
  documents: string[];
  created_at: string;
  updated_at: string;
  admin_notes: string;
  user: {
    id: string;
    telegram_id: number;
    first_name: string;
    last_name: string;
    username: string;
    level: number;
    points: number;
  };
}

interface TestData {
  id: string;
  title: string;
  category: string;
  is_active: boolean;
  analytics: {
    total_attempts: number;
    avg_score: number;
    passed_count: number;
    pass_rate: number;
    available_questions: number;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function EnhancedAdminDashboard() {
  // 🔥 СОСТОЯНИЕ
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'users' | 'tests' | 'analytics' | 'settings'>('dashboard');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [tests, setTests] = useState<TestData[]>([]);
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [period, setPeriod] = useState('7d');
  const [serverError, setServerError] = useState<string | null>(null);
const [settings, setSettings] = useState({
  maintenanceMode: false,
  registrationEnabled: true,
  notificationsEnabled: true
});
const [systemSettings, setSystemSettings] = useState<any>(null);
const [logs, setLogs] = useState<any[]>([]);
const [backups, setBackups] = useState<any[]>([]);
const [notificationHistory, setNotificationHistory] = useState<any[]>([]);
const [notificationTemplates, setNotificationTemplates] = useState<any[]>([]);
const [showNotificationManager, setShowNotificationManager] = useState(false);
const [showLogsViewer, setShowLogsViewer] = useState(false);
const [showBackupManager, setShowBackupManager] = useState(false);
const [analyticsData, setAnalyticsData] = useState<any>(null);
const [systemStatus, setSystemStatus] = useState<any>(null);
const [analyticsPeriod, setAnalyticsPeriod] = useState('30d');
const [analyticsTab, setAnalyticsTab] = useState<'overview' | 'users' | 'tests' | 'performance' | 'reports'>('overview');
const [error, setError] = useState<string | null>(null);
const [users, setUsers] = useState<any[]>([]);
const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
const [userFilters, setUserFilters] = useState({
  search: '',
  level: '',
  registeredAfter: '',
  lastActiveAfter: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
  isActive: 'all'
});
const [usersPagination, setUsersPagination] = useState({
  current: 1,
  pageSize: 20,
  total: 0
});
const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  // Фильтры
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  // 🔥 ПРОВЕРКА ДОСТУПА
  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
  try {
    console.log('🔐 Checking admin access...');
    
    // Сначала проверяем базовую авторизацию
    const user = await api.getProfile();
    console.log('👤 Current user:', user);
    
    // Проверяем админские Telegram ID на клиенте (дополнительная проверка)
    const adminTelegramIds = [1077964079, 872587503]; // Ваши админские ID
    const isAdminByTelegramId = adminTelegramIds.includes(user.user?.telegram_id || user.telegram_id);
    
    console.log('🔍 User Telegram ID:', user.user?.telegram_id || user.telegram_id);
    console.log('🔍 Is admin by Telegram ID:', isAdminByTelegramId);
    
    if (!isAdminByTelegramId) {
      console.log('❌ User is not in admin list');
      setIsAuthorized(false);
      return;
    }
    
    // Пытаемся загрузить dashboard stats для проверки серверных прав
    try {
      console.log('📊 Loading dashboard stats to verify admin access...');
      await loadDashboardStats();
      console.log('✅ Dashboard stats loaded successfully - admin access confirmed');
      setIsAuthorized(true);
    } catch (dashboardError: any) {
      console.log('⚠️ Dashboard stats failed, but user is in admin list. Checking error type...');
      
      // Если ошибка 403 - нет прав, если 500 - проблема с сервером, но права есть
      if (dashboardError.message?.includes('403') || dashboardError.message?.includes('Access denied')) {
        console.log('❌ Server confirmed: no admin rights');
        setIsAuthorized(false);
      } else if (dashboardError.message?.includes('500') || dashboardError.message?.includes('Internal Server Error')) {
        console.log('⚠️ Server error, but user has admin rights - allowing access');
        setIsAuthorized(true);
        
        // Показываем дашборд с ошибкой загрузки данных
        setDashboardStats({
          summary: {
            total_users: 0,
            total_applications: 0,
            total_tests: 0,
            active_users: 0
          },
          period_stats: {
            new_users: 0,
            new_applications: 0,
            tests_taken: 0,
            active_users: 0
          },
          applications_by_status: {},
          tests_analytics: [],
          chart_data: []
        });
      } else {
        console.log('❌ Unknown error type:', dashboardError);
        setIsAuthorized(false);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Admin access check failed:', error);
    
    // Если ошибка авторизации - пользователь не залогинен
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      console.log('❌ User not authenticated');
      window.location.href = '/login';
      return;
    }
    
    setIsAuthorized(false);
  } finally {
    setIsLoading(false);
  }
};
const loadSystemSettings = useCallback(async () => {
  try {
    const settings = await api.getSystemSettings();
    setSystemSettings(settings);
  } catch (error) {
    console.error('Failed to load system settings:', error);
  }
}, []);

// Сохранение системных настроек
const saveSystemSettings = async (newSettings: any) => {
  try {
    await api.updateSystemSettings(newSettings);
    setSystemSettings(newSettings);
    telegram.hapticFeedback('notification', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    telegram.hapticFeedback('notification', 'error');
  }
};

// Загрузка логов
const loadSystemLogs = async (level: string = 'INFO', limit: number = 100) => {
  try {
    const logsData = await api.getSystemLogs({ level: level as any, limit });
    setLogs(logsData.logs || []);
  } catch (error) {
    console.error('Failed to load logs:', error);
  }
};

// Управление резервными копиями
const createBackup = async () => {
  try {
    const result = await api.createBackup();
    await loadBackupHistory();
    telegram.hapticFeedback('notification', 'success');
    return result;
  } catch (error) {
    console.error('Backup creation failed:', error);
    telegram.hapticFeedback('notification', 'error');
  }
};

const loadBackupHistory = async () => {
  try {
    const backupData = await api.getBackupHistory();
    setBackups(backupData.backups || []);
  } catch (error) {
    console.error('Failed to load backup history:', error);
  }
};

// Управление уведомлениями
const loadNotificationData = async () => {
  try {
    const [history, templates] = await Promise.all([
      api.getNotificationHistory(),
      api.getNotificationTemplates()
    ]);
    setNotificationHistory(history.notifications || []);
    setNotificationTemplates(templates.templates || []);
  } catch (error) {
    console.error('Failed to load notification data:', error);
  }
};

const sendBroadcastNotification = async (data: any) => {
  try {
    await api.broadcastNotificationAdvanced(data);
    await loadNotificationData();
    telegram.hapticFeedback('notification', 'success');
  } catch (error) {
    console.error('Failed to send broadcast:', error);
    telegram.hapticFeedback('notification', 'error');
  }
};

  // 🔥 ЗАГРУЗКА ДАННЫХ
  const loadDashboardStats = useCallback(async () => {
  try {
    console.log(`📊 Loading dashboard stats for period: ${period}`);
    const stats = await api.getDashboardStats(period);
    console.log('✅ Dashboard stats loaded:', stats);
    setDashboardStats(stats);
  } catch (error: any) {
    console.error('❌ Failed to load dashboard stats:', error);
    
    // Не показываем ошибку пользователю, если это проблема сервера
    if (error.message?.includes('500')) {
      console.log('⚠️ Server error loading stats, using fallback data');
      // Устанавливаем базовые данные
      setDashboardStats({
        summary: {
          total_users: 0,
          total_applications: 0,
          total_tests: 0,
          active_users: 0
        },
        period_stats: {
          new_users: 0,
          new_applications: 0,
          tests_taken: 0,
          active_users: 0
        },
        applications_by_status: {},
        tests_analytics: [],
        chart_data: []
      });
    } else {
      throw error; // Перебрасываем ошибку для обработки в checkAdminAccess
    }
  }
}, [period]);


  const loadApplications = useCallback(async () => {
  try {
    console.log('📄 Loading applications with filters:', filters);
    
    // Используем исправленный метод API
    const response = await api.getAdminApplicationsSimple(
      filters.status, 
      50, // limit
      0   // offset
    );
    
    console.log('✅ Applications response:', response);
    
    // Проверяем структуру ответа
    if (response && Array.isArray(response.applications)) {
      setApplications(response.applications);
      console.log(`✅ Loaded ${response.applications.length} applications`);
    } else if (response && Array.isArray(response)) {
      // Если ответ это просто массив (fallback)
      setApplications(response);
      console.log(`✅ Loaded ${response.length} applications (fallback format)`);
    } else {
      console.log('⚠️ Unexpected response format:', response);
      setApplications([]);
    }
    
  } catch (error: any) {
    console.error('❌ Failed to load applications:', error);
    
    // Показываем пользователю ошибку, но не ломаем интерфейс
    setApplications([]);
    
    // Если это ошибка сети или сервера, показываем уведомление
    if (error.message?.includes('500') || error.message?.includes('Network')) {
      console.log('⚠️ Server error, applications may be unavailable');
      // Можно добавить toast notification здесь
    }
  }
}, [filters]);
const loadAnalytics = useCallback(async () => {
  try {
    console.log('📊 Loading analytics data...');
    setError(null);
    
    const [usersAnalytics, testsAnalytics, systemData] = await Promise.all([
      api.getUsersAnalytics(analyticsPeriod),
      api.getTestsAnalytics(analyticsPeriod),
      api.getSystemStatus()
    ]);
    
    setAnalyticsData({
      users: usersAnalytics,
      tests: testsAnalytics,
      system: systemData
    });
    setSystemStatus(systemData);
    
  } catch (error: any) {
    console.error('❌ Failed to load analytics:', error);
    setError(`Ошибка загрузки аналитики: ${error.message}`);
  }
}, [analyticsPeriod]);

const generateReport = async (type: string, format: string) => {
  try {
    const reportConfig = {
      type: type as 'users' | 'applications' | 'tests' | 'performance',
      date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      date_to: new Date().toISOString(),
      format: format as 'json' | 'csv' | 'pdf'
    };
    
    const response = await api.generateCustomReport(reportConfig);
    
    // Download the report
    const blob = new Blob([response.content], { type: response.content_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    telegram.hapticFeedback('notification', 'success');
  } catch (error) {
    console.error('Report generation failed:', error);
    telegram.hapticFeedback('notification', 'error');
  }
};

const renderAnalyticsOverview = () => (
  <div className="space-y-6">
    {/* System Status Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {systemStatus && [
        { 
          title: 'Статус системы', 
          value: systemStatus.status, 
          color: systemStatus.status === 'healthy' ? 'green' : 'red',
          icon: Shield
        },
        { 
          title: 'CPU', 
          value: `${systemStatus.metrics?.cpu_usage?.toFixed(1)}%`, 
          color: systemStatus.metrics?.cpu_usage > 80 ? 'red' : 'green',
          icon: Activity
        },
        { 
          title: 'Память', 
          value: `${systemStatus.metrics?.memory_usage?.toFixed(1)}%`, 
          color: systemStatus.metrics?.memory_usage > 80 ? 'red' : 'green',
          icon: Database
        },
        { 
          title: 'Диск', 
          value: `${systemStatus.metrics?.disk_usage?.toFixed(1)}%`, 
          color: systemStatus.metrics?.disk_usage > 90 ? 'red' : 'green',
          icon: Globe
        }
      ].map((metric, index) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 bg-${metric.color}-100 rounded-lg flex items-center justify-center`}>
                <Icon className={`w-5 h-5 text-${metric.color}-600`} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800">{metric.value}</h3>
            <p className="text-gray-600 text-sm">{metric.title}</p>
          </motion.div>
        );
      })}
    </div>

    {/* Database Statistics */}
    {systemStatus?.database_stats && (
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Статистика базы данных</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {systemStatus.database_stats.users?.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Пользователи</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {systemStatus.database_stats.applications?.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Заявки</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {systemStatus.database_stats.test_results?.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Результаты тестов</div>
          </div>
        </div>
      </div>
    )}

    {/* Quick Actions */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { title: 'Отчет по пользователям', type: 'users', icon: Users, color: 'blue' },
        { title: 'Отчет по тестам', type: 'tests', icon: BarChart3, color: 'green' },
        { title: 'Отчет по заявкам', type: 'applications', icon: FileText, color: 'purple' },
        { title: 'Производительность', type: 'performance', icon: TrendingUp, color: 'orange' }
      ].map((report) => {
        const Icon = report.icon;
        return (
          <motion.div
            key={report.type}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`bg-gradient-to-r from-${report.color}-500 to-${report.color}-600 text-white p-4 rounded-xl cursor-pointer shadow-lg`}
            onClick={() => generateReport(report.type, 'csv')}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold">{report.title}</h4>
                <p className="text-xs opacity-90">Скачать CSV</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  </div>
);

const renderUsersAnalytics = () => (
  <div className="space-y-6">
    {analyticsData?.users && (
      <>
        {/* User Registration Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Регистрации пользователей</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.users.registrations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* User Activity Chart */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Активность пользователей</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.users.activity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="active_users" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
              <Area type="monotone" dataKey="tests_taken" stackId="1" stroke="#8884d8" fill="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Users */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Топ пользователи</h3>
          <div className="space-y-3">
            {analyticsData.users.top_users?.slice(0, 10).map((user: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-medium text-sm">{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">Уровень {user.level} • {user.tests_count} тестов</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{user.points.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">{user.avg_score}% средний балл</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>
    )}
  </div>
);

const renderTestsAnalytics = () => (
  <div className="space-y-6">
    {analyticsData?.tests && (
      <>
        {/* Tests Performance */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Производительность тестов</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.tests.analytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="attempts" fill="#8884d8" name="Попытки" />
              <Bar dataKey="passed_count" fill="#82ca9d" name="Сданы" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pass Rates */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Проходные баллы по категориям</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.tests.analytics?.map((test: any) => ({
                  name: test.category,
                  value: test.pass_rate
                }))}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}%`}
              >
                {analyticsData.tests.analytics?.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Test Stats */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Детальная статистика тестов</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категория</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Попытки</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Средний балл</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Проходной балл</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Последняя попытка</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {analyticsData.tests.analytics?.map((test: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 capitalize">{test.category}</td>
                    <td className="px-4 py-3 text-gray-500">{test.attempts}</td>
                    <td className="px-4 py-3 text-gray-500">{test.avg_score}%</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        test.pass_rate >= 70 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {test.pass_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {test.last_attempt ? new Date(test.last_attempt).toLocaleDateString('ru-RU') : 'Нет данных'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}
  </div>
);

const renderPerformanceAnalytics = () => (
  <div className="space-y-6">
    {/* Performance Metrics */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {systemStatus?.metrics && (
        <>
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Использование CPU</h3>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Текущее</span>
                  <span className="text-sm font-medium text-gray-900">{systemStatus.metrics.cpu_usage?.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      systemStatus.metrics.cpu_usage > 80 ? 'bg-red-500' : 
                      systemStatus.metrics.cpu_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${systemStatus.metrics.cpu_usage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Использование памяти</h3>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {(systemStatus.metrics.memory_total - systemStatus.metrics.memory_available) / 1024 / 1024 / 1024 < 1 
                      ? `${((systemStatus.metrics.memory_total - systemStatus.metrics.memory_available) / 1024 / 1024).toFixed(0)} MB`
                      : `${((systemStatus.metrics.memory_total - systemStatus.metrics.memory_available) / 1024 / 1024 / 1024).toFixed(1)} GB`
                    } из {(systemStatus.metrics.memory_total / 1024 / 1024 / 1024).toFixed(1)} GB
                  </span>
                  <span className="text-sm font-medium text-gray-900">{systemStatus.metrics.memory_usage?.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      systemStatus.metrics.memory_usage > 80 ? 'bg-red-500' : 
                      systemStatus.metrics.memory_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${systemStatus.metrics.memory_usage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>

    {/* Component Status */}
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Статус компонентов</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {systemStatus?.components && Object.entries(systemStatus.components).map(([component, status]) => (
          <div key={component} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 capitalize">{component}</span>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                status === 'healthy' ? 'bg-green-100 text-green-800' : 
                status === 'degraded' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
              }`}>
                {status === 'healthy' ? 'Работает' : status === 'degraded' ? 'Проблемы' : 'Ошибка'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const renderReports = () => (
  <div className="space-y-6">
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Генерация отчетов</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { type: 'users', title: 'Отчет по пользователям', description: 'Статистика регистраций, активности и прогресса' },
          { type: 'tests', title: 'Отчет по тестам', description: 'Результаты тестов, проходные баллы, аналитика' },
          { type: 'applications', title: 'Отчет по заявкам', description: 'Статус заявок, процент одобрения, сроки' },
          { type: 'performance', title: 'Отчет производительности', description: 'Метрики системы, нагрузка, ошибки' }
        ].map((report) => (
          <div key={report.type} className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">{report.title}</h4>
            <p className="text-sm text-gray-600 mb-4">{report.description}</p>
            <div className="flex space-x-2">
              <button
                onClick={() => generateReport(report.type, 'csv')}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm admin-touch-button"
              >
                CSV
              </button>
              <button
                onClick={() => generateReport(report.type, 'json')}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm admin-touch-button"
              >
                JSON
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const renderAnalytics = () => (
  <div className="space-y-4 sm:space-y-6">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Аналитика и отчеты</h2>
      <div className="flex items-center space-x-3">
        <select
          value={analyticsPeriod}
          onChange={(e) => setAnalyticsPeriod(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm admin-touch-button"
        >
          <option value="7d">7 дней</option>
          <option value="30d">30 дней</option>
          <option value="90d">90 дней</option>
        </select>
        <button
          onClick={loadAnalytics}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm admin-touch-button"
        >
          Обновить
        </button>
      </div>
    </div>

    {/* Analytics Tabs */}
    <div className="border-b border-gray-200">
      <nav className="flex space-x-8 overflow-x-auto scrollbar-hide">
        {[
          { id: 'overview', name: 'Обзор', icon: BarChart3 },
          { id: 'users', name: 'Пользователи', icon: Users },
          { id: 'tests', name: 'Тесты', icon: FileText },
          { id: 'performance', name: 'Производительность', icon: Activity },
          { id: 'reports', name: 'Отчеты', icon: Download }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setAnalyticsTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                analyticsTab === tab.id
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

    {/* Analytics Content */}
    <AnimatePresence mode="wait">
      <motion.div
        key={analyticsTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {analyticsTab === 'overview' && renderAnalyticsOverview()}
        {analyticsTab === 'users' && renderUsersAnalytics()}
        {analyticsTab === 'tests' && renderTestsAnalytics()}
        {analyticsTab === 'performance' && renderPerformanceAnalytics()}
        {analyticsTab === 'reports' && renderReports()}
      </motion.div>
    </AnimatePresence>
  </div>
);

  const loadTests = useCallback(async () => {
  try {
    console.log('📝 Loading tests for admin...');
    
    // Используем обычный endpoint для получения тестов
    const testsData = await api.getTests();
    console.log('✅ Tests loaded:', testsData);
    
    // Преобразуем данные в нужный формат для admin панели
    const formattedTests = testsData.map((test: any) => ({
      id: test.id,
      title: test.title,
      description: test.description || '',
      category: test.category,
      time_limit: test.time_limit,
      passing_score: test.passing_score,
      questions_count: test.questions_count,
      is_active: test.is_active !== false, // По умолчанию активен
      created_at: test.created_at || new Date().toISOString(),
      analytics: {
        total_attempts: 0,
        avg_score: 0,
        passed_count: 0,
        pass_rate: 0,
        available_questions: test.questions_count || 0
      }
    }));
    
    setTests(formattedTests);
    
  } catch (error: any) {
    console.error('❌ Failed to load tests:', error);
    setTests([]);
  }
}, []);


  useEffect(() => {
    if (activeTab === 'dashboard' && isAuthorized) {
      loadDashboardStats();
    } else if (activeTab === 'applications' && isAuthorized) {
      loadApplications();
    } else if (activeTab === 'tests' && isAuthorized) {
      loadTests();
    }
  }, [activeTab, isAuthorized, loadDashboardStats, loadApplications, loadTests]);

  // 🔥 ОБРАБОТЧИКИ
  const handleBulkStatusUpdate = async (status: string) => {
  if (selectedApps.size === 0) {
    console.log('⚠️ No applications selected for bulk update');
    return;
  }

  try {
    console.log(`📝 Bulk updating ${selectedApps.size} applications to ${status}`);
    
    const applicationIds = Array.from(selectedApps);
    
    // Используем исправленный метод API
    const result = await api.bulkUpdateApplications(applicationIds, status);
    
    console.log('✅ Bulk update result:', result);
    
    // Перезагружаем данные
    await loadApplications();
    setSelectedApps(new Set());
    
    telegram.hapticFeedback('notification', 'success');
    
  } catch (error: any) {
    console.error('❌ Bulk update failed:', error);
    telegram.hapticFeedback('notification', 'error');
    
    // Все равно пытаемся перезагрузить данные
    try {
      await loadApplications();
    } catch (reloadError) {
      console.error('❌ Failed to reload applications after bulk update error');
    }
  }
};

const loadUsers = useCallback(async () => {
  try {
    console.log('👥 Loading users with filters:', userFilters);
    
    const params = {
      limit: usersPagination.pageSize,
      offset: (usersPagination.current - 1) * usersPagination.pageSize,
      search: userFilters.search || undefined,
      level: userFilters.level ? parseInt(userFilters.level) : undefined,
      registered_after: userFilters.registeredAfter || undefined,
      last_active_after: userFilters.lastActiveAfter || undefined,
      sort_by: userFilters.sortBy,
      sort_order: userFilters.sortOrder
    };
    
    const response = await api.getAdminUsersDetailed(params);
    console.log('✅ Users loaded:', response);
    
    setUsers(response.users || []);
    setUsersPagination(prev => ({
      ...prev,
      total: response.total || 0
    }));
    
  } catch (error: any) {
    console.error('❌ Failed to load users:', error);
    setUsers([]);
  }
}, [userFilters, usersPagination.current, usersPagination.pageSize]);

const handleBulkUserAction = async (action: string) => {
  if (selectedUsers.size === 0) return;
  
  try {
    const userIds = Array.from(selectedUsers);
    
    switch (action) {
      case 'activate':
        await Promise.all(userIds.map(id => api.updateUserStatusAdmin(id, true)));
        break;
      case 'deactivate':
        await Promise.all(userIds.map(id => api.updateUserStatusAdmin(id, false)));
        break;
      case 'delete':
        if (confirm(`Удалить ${userIds.length} пользователей? Это действие нельзя отменить.`)) {
          await api.bulkDeleteUsers(userIds);
        } else {
          return;
        }
        break;
      case 'award_points':
        const points = prompt('Количество баллов для начисления:');
        const reason = prompt('Причина начисления баллов:') || 'Admin award';
        if (points && !isNaN(parseInt(points))) {
          await api.bulkAwardPoints(userIds, parseInt(points), reason);
        }
        break;
    }
    
    await loadUsers();
    setSelectedUsers(new Set());
    telegram.hapticFeedback('notification', 'success');
    
  } catch (error: any) {
    console.error('❌ Bulk action failed:', error);
    telegram.hapticFeedback('notification', 'error');
  }
};

const exportUsers = async (format: 'csv' | 'json') => {
  try {
    const response = await api.exportUsers(format);
    
    const blob = new Blob([response.content], { type: response.content_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    telegram.hapticFeedback('notification', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    telegram.hapticFeedback('notification', 'error');
  }
};

const renderUsers = () => (
  <div className="space-y-4 sm:space-y-6">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Управление пользователями</h2>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => exportUsers('csv')}
          className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm admin-touch-button"
        >
          <Download className="w-4 h-4" />
          <span>CSV</span>
        </button>
        <button
          onClick={() => exportUsers('json')}
          className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm admin-touch-button"
        >
          <Download className="w-4 h-4" />
          <span>JSON</span>
        </button>
      </div>
    </div>

    {/* Error Display */}
    {error && (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-red-800 font-medium">Ошибка загрузки пользователей</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-700"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    )}

    {/* Filters */}
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Поиск</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Имя, username, Telegram ID..."
              value={userFilters.search}
              onChange={(e) => setUserFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Минимальный уровень</label>
          <select
            value={userFilters.level}
            onChange={(e) => setUserFilters(prev => ({ ...prev, level: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">Все уровни</option>
            <option value="1">1+</option>
            <option value="5">5+</option>
            <option value="10">10+</option>
            <option value="15">15+</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Сортировка</label>
          <div className="flex space-x-2">
            <select
              value={userFilters.sortBy}
              onChange={(e) => setUserFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="created_at">Дате регистрации</option>
              <option value="points">Баллам</option>
              <option value="level">Уровню</option>
              <option value="last_activity">Активности</option>
            </select>
            <button
              onClick={() => setUserFilters(prev => ({ 
                ...prev, 
                sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc' 
              }))}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 admin-touch-button"
            >
              {userFilters.sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => {
              setUsersPagination(prev => ({ ...prev, current: 1 }));
              loadUsers();
            }}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium admin-touch-button"
          >
            Применить фильтры
          </button>
        </div>
      </div>
    </div>

    {/* Bulk Actions */}
    {selectedUsers.size > 0 && (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-blue-800 font-medium">
            {selectedUsers.size} пользователей выбрано
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleBulkUserAction('activate')}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-sm admin-touch-button"
            >
              Активировать
            </button>
            <button
              onClick={() => handleBulkUserAction('deactivate')}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-sm admin-touch-button"
            >
              Деактивировать
            </button>
            <button
              onClick={() => handleBulkUserAction('award_points')}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded text-sm admin-touch-button"
            >
              Начислить баллы
            </button>
            <button
              onClick={() => handleBulkUserAction('delete')}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm admin-touch-button"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Users Table */}
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full admin-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === users.length && users.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(new Set(users.map(user => user.id)));
                    } else {
                      setSelectedUsers(new Set());
                    }
                  }}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Пользователь</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase desktop-only">Telegram ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Уровень</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Баллы</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase desktop-only">Тесты</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-700 mb-2">Пользователи не найдены</p>
                  <p className="text-sm text-gray-500">Попробуйте изменить фильтры поиска</p>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedUsers);
                        if (e.target.checked) {
                          newSelected.add(user.id);
                        } else {
                          newSelected.delete(user.id);
                        }
                        setSelectedUsers(newSelected);
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500">@{user.username || 'unknown'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 desktop-only">
                    {user.telegram_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {user.points.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 desktop-only">
                    {user.total_tests} ({user.avg_score}%)
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          // TODO: Открыть детальную информацию о пользователе
                          console.log('👤 View user details:', user.id);
                        }}
                        className="text-blue-600 hover:text-blue-900 admin-touch-button"
                        title="Подробности"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.updateUserStatusAdmin(user.id, !user.is_active);
                            await loadUsers();
                            telegram.hapticFeedback('impact', 'light');
                          } catch (error) {
                            console.error('Failed to update user status:', error);
                          }
                        }}
                        className="text-yellow-600 hover:text-yellow-900 admin-touch-button"
                        title={user.is_active ? 'Деактивировать' : 'Активировать'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {usersPagination.total > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Показано {Math.min(usersPagination.pageSize, users.length)} из {usersPagination.total} пользователей
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setUsersPagination(prev => ({ ...prev, current: prev.current - 1 }));
              }}
              disabled={usersPagination.current === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 admin-touch-button"
            >
              Назад
            </button>
            <span className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
              {usersPagination.current}
            </span>
            <button
              onClick={() => {
                setUsersPagination(prev => ({ ...prev, current: prev.current + 1 }));
              }}
              disabled={usersPagination.current * usersPagination.pageSize >= usersPagination.total}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 admin-touch-button"
            >
              Вперед
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
);

  const handleExportApplications = async (format: 'csv' | 'json') => {
  try {
    console.log(`📤 Exporting applications in ${format} format`);
    
    const response = await api.exportApplications(format, filters.status);

    // Создаем ссылку для скачивания
    const blob = new Blob([response.content], { type: response.content_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Export completed:', response.filename);
    telegram.hapticFeedback('notification', 'success');
    
  } catch (error: any) {
    console.error('❌ Export failed:', error);
    telegram.hapticFeedback('notification', 'error');
  }
};


  const toggleTestStatus = async (testId: string, isActive: boolean) => {
  try {
    console.log(`🔄 Toggling test ${testId} status from ${isActive} to ${!isActive}`);
    
    // Пока что просто обновляем локально, так как у нас нет admin endpoint для тестов
    setTests(prevTests => 
      prevTests.map(test => 
        test.id === testId 
          ? { ...test, is_active: !isActive }
          : test
      )
    );
    
    telegram.hapticFeedback('impact', 'light');
    
    // TODO: Добавить реальный API вызов когда будет admin endpoint
    // await api.updateTestStatus(testId, !isActive);
    
  } catch (error: any) {
    console.error('Failed to update test status:', error);
    
    // Возвращаем обратно при ошибке
    setTests(prevTests => 
      prevTests.map(test => 
        test.id === testId 
          ? { ...test, is_active: isActive }
          : test
      )
    );
  }
};

  // 🔥 КОМПОНЕНТЫ РЕНДЕРИНГА

  const renderDashboard = () => {
  if (!dashboardStats) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span className="ml-2 text-gray-600">Загрузка...</span>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Error Alert - if any */}
      {serverError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-yellow-800 font-medium text-sm">Проблемы с загрузкой данных</h3>
              <p className="text-yellow-700 text-xs sm:text-sm mt-1">
                Сервер временно недоступен. Отображаются базовые данные.
              </p>
            </div>
            <button
              onClick={async () => {
                setServerError(null);
                try {
                  await loadDashboardStats();
                } catch (error) {
                  setServerError('Ошибка загрузки данных');
                }
              }}
              className="flex items-center space-x-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs admin-touch-button"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Повторить</span>
            </button>
          </div>
        </div>
      )}

      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Дашборд</h2>
        <div className="flex items-center space-x-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-auto admin-touch-button"
          >
            <option value="1d">Последний день</option>
            <option value="7d">Последние 7 дней</option>
            <option value="30d">Последние 30 дней</option>
            <option value="90d">Последние 90 дней</option>
          </select>
          
          <button
            onClick={async () => {
              try {
                setServerError(null);
                await loadDashboardStats();
                telegram.hapticFeedback('impact', 'light');
              } catch (error: any) {
                setServerError('Ошибка загрузки данных');
                telegram.hapticFeedback('notification', 'error');
              }
            }}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm admin-touch-button"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Обновить</span>
          </button>
        </div>
      </div>

      {/* Summary Cards - Responsive Grid */}
      <div className="admin-responsive-grid">
        {[
          { title: 'Пользователи', value: dashboardStats.summary.total_users, change: dashboardStats.period_stats.new_users, icon: Users, color: 'blue' },
          { title: 'Заявки', value: dashboardStats.summary.total_applications, change: dashboardStats.period_stats.new_applications, icon: FileText, color: 'green' },
          { title: 'Тесты', value: dashboardStats.summary.total_tests, change: dashboardStats.period_stats.tests_taken, icon: BarChart3, color: 'purple' },
          { title: 'Активные', value: dashboardStats.summary.active_users, change: dashboardStats.period_stats.active_users, icon: Activity, color: 'orange' }
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 admin-stat-card ${
                serverError ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${stat.color}-600`} />
                </div>
                <span className={`text-xs sm:text-sm text-${stat.change > 0 ? 'green' : 'gray'}-600`}>
                  {stat.change > 0 ? '+' : ''}{stat.change}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">{stat.value.toLocaleString()}</h3>
              <p className="text-gray-600 text-xs sm:text-sm">{stat.title}</p>
              {serverError && (
                <p className="text-yellow-600 text-xs mt-1">Данные неполные</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Charts - Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Activity Chart */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Активность</h3>
          <div className="admin-chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dashboardStats.chart_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="users" stackId="1" stroke="#8884d8" fill="#8884d8" />
                <Area type="monotone" dataKey="tests" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                <Area type="monotone" dataKey="applications" stackId="1" stroke="#ffc658" fill="#ffc658" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Chart */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Статусы заявок</h3>
          <div className="admin-chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(dashboardStats.applications_by_status).map(([status, count]) => ({
                    name: status,
                    value: count
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {Object.entries(dashboardStats.applications_by_status).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Test Analytics */}
      <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Аналитика тестов</h3>
        <div className="admin-chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dashboardStats.tests_analytics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="attempts" fill="#8884d8" name="Попытки" />
              <Bar dataKey="passed" fill="#82ca9d" name="Сданы" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};


  const renderApplications = () => (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Поиск по имени, ИИН, программе..."
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
              <option value="submitted">Подана</option>
              <option value="reviewing">На рассмотрении</option>
              <option value="approved">Одобрена</option>
              <option value="rejected">Отклонена</option>
              <option value="accepted">Принят</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {selectedApps.size > 0 && (
              <>
                <span className="text-sm text-gray-600">{selectedApps.size} выбрано</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkStatusUpdate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Массовые действия</option>
                  <option value="reviewing">На рассмотрение</option>
                  <option value="approved">Одобрить</option>
                  <option value="rejected">Отклонить</option>
                </select>
              </>
            )}
            
            <button
              onClick={() => handleExportApplications('csv')}
              className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            
            <button
              onClick={() => handleExportApplications('json')}
              className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              <Download className="w-4 h-4" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedApps.size === applications.length && applications.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedApps(new Set(applications.map(app => app.id)));
                      } else {
                        setSelectedApps(new Set());
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заявка</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Заявитель</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Программа</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ЕНТ</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {applications.map((app) => (
                <motion.tr
                  key={app.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedApps.has(app.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedApps);
                        if (e.target.checked) {
                          newSelected.add(app.id);
                        } else {
                          newSelected.delete(app.id);
                        }
                        setSelectedApps(newSelected);
                      }}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">#{app.application_number}</div>
                      <div className="text-sm text-gray-500">{app.personal_data?.iin}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {app.user.first_name} {app.user.last_name}
                      </div>
                      <div className="text-sm text-gray-500">@{app.user.username}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{app.education?.program}</div>
                    <div className="text-sm text-gray-500">{app.education?.degree}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900">{app.education?.ent_score}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      app.status === 'approved' ? 'bg-green-100 text-green-800' :
                      app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      app.status === 'reviewing' ? 'bg-yellow-100 text-yellow-800' :
                      app.status === 'accepted' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(app.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="text-green-600 hover:text-green-900">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTests = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Управление тестами</h2>
        <button className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg">
          <Plus className="w-4 h-4" />
          <span>Добавить тест</span>
        </button>
      </div>

      <div className="grid gap-6">
        {tests.map((test) => (
          <motion.div
            key={test.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{test.title}</h3>
                <p className="text-gray-600 capitalize">{test.category}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleTestStatus(test.id, test.is_active)}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    test.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {test.is_active ? 'Активен' : 'Неактивен'}
                </button>
                <button className="text-blue-600 hover:text-blue-900">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{test.analytics.total_attempts}</div>
                <div className="text-sm text-gray-600">Попыток</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{test.analytics.avg_score}%</div>
                <div className="text-sm text-gray-600">Средний балл</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{test.analytics.pass_rate}%</div>
                <div className="text-sm text-gray-600">Прошли</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{test.analytics.available_questions}</div>
                <div className="text-sm text-gray-600">Вопросов</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{test.analytics.passed_count}</div>
                <div className="text-sm text-gray-600">Сдали</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
const BroadcastModal = ({ isOpen, onClose, onSend }: any) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl w-full max-w-md p-6"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-4">Массовая рассылка</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Заголовок</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Введите заголовок"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Сообщение</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Введите текст сообщения"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Получатели</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Все пользователи</option>
              <option value="active">Активные пользователи</option>
              <option value="level_5">Пользователи 5+ уровня</option>
            </select>
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              onSend({ title, message, target });
              setTitle('');
              setMessage('');
              setTarget('all');
              onClose();
            }}
            disabled={!title || !message}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Отправить
          </button>
        </div>
      </motion.div>
    </div>
  );
};
  const renderSettings = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-800">Настройки системы</h2>
      <button
        onClick={loadSystemSettings}
        className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg admin-touch-button"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Обновить</span>
      </button>
    </div>
    
    <div className="grid gap-6">
      {/* Общие настройки */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Общие настройки</h3>
        {systemSettings ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Режим обслуживания</h4>
                <p className="text-sm text-gray-600">Временно отключить доступ к системе</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={systemSettings.maintenance_mode}
                  onChange={async (e) => {
                    const newSettings = { ...systemSettings, maintenance_mode: e.target.checked };
                    await saveSystemSettings(newSettings);
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Регистрация новых пользователей</h4>
                <p className="text-sm text-gray-600">Разрешить создание новых аккаунтов</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={systemSettings.registration_enabled}
                  onChange={async (e) => {
                    const newSettings = { ...systemSettings, registration_enabled: e.target.checked };
                    await saveSystemSettings(newSettings);
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-800">Уведомления</h4>
                <p className="text-sm text-gray-600">Отправка push-уведомлений пользователям</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={systemSettings.notifications_enabled}
                  onChange={async (e) => {
                    const newSettings = { ...systemSettings, notifications_enabled: e.target.checked };
                    await saveSystemSettings(newSettings);
                  }}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Дополнительные настройки */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Максимум попыток тестов
                </label>
                <input
                  type="number"
                  value={systemSettings.max_test_attempts}
                  onChange={(e) => setSystemSettings((prev: any) => ({ ...prev, max_test_attempts: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Проходной балл по умолчанию (%)
                </label>
                <input
                  type="number"
                  value={systemSettings.default_passing_score}
                  onChange={(e) => setSystemSettings((prev: any) => ({ ...prev, default_passing_score: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        )}
        
        {/* Кнопка сохранения */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button 
            onClick={() => saveSystemSettings(systemSettings)}
            disabled={!systemSettings}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-medium transition-colors admin-touch-button"
          >
            Сохранить настройки
          </button>
        </div>
      </div>

      {/* Уведомления */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Уведомления</h3>
        <div className="space-y-4">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setShowBroadcastModal(true);
              telegram.hapticFeedback('impact', 'medium');
            }}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-medium text-gray-800">Массовая рассылка</h4>
                <p className="text-sm text-gray-600">Отправить уведомление всем пользователям</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.button>
          
          <button 
            onClick={async () => {
              await loadNotificationData();
              setShowNotificationManager(true);
              telegram.hapticFeedback('impact', 'light');
            }}
            className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <h4 className="font-medium text-gray-800">Управление уведомлениями</h4>
                <p className="text-sm text-gray-600">История и шаблоны уведомлений</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Система и мониторинг */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Система и мониторинг</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Системные компоненты */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Компоненты системы</h4>
            {systemStatus?.components && Object.entries(systemStatus.components).map(([component, status]) => (
              <motion.div 
                key={component}
                whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer"
                onClick={() => {
                  console.log(`🔍 Checking ${component} status`);
                  telegram.hapticFeedback('impact', 'light');
                }}
              >
                <span className="font-medium text-gray-800 capitalize">{component}</span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  status === 'healthy' ? 'bg-green-100 text-green-800' : 
                  status === 'degraded' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                }`}>
                  {status === 'healthy' ? 'OK' : status === 'degraded' ? 'Warning' : 'Error'}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Системные действия */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700">Системные действия</h4>
            <button 
              onClick={async () => {
                await loadSystemLogs();
                setShowLogsViewer(true);
                telegram.hapticFeedback('impact', 'light');
              }}
              className="w-full flex items-center space-x-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Eye className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-800">Просмотр логов</span>
            </button>

            <button 
              onClick={async () => {
                await loadBackupHistory();
                setShowBackupManager(true);
                telegram.hapticFeedback('impact', 'light');
              }}
              className="w-full flex items-center space-x-3 p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Database className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-800">Резервные копии</span>
            </button>

            <button 
              onClick={async () => {
                try {
                  await api.clearCache();
                  telegram.hapticFeedback('notification', 'success');
                } catch (error) {
                  telegram.hapticFeedback('notification', 'error');
                }
              }}
              className="w-full flex items-center space-x-3 p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-purple-800">Очистить кэш</span>
            </button>

            <button 
              onClick={async () => {
                try {
                  await api.optimizeDatabase();
                  telegram.hapticFeedback('notification', 'success');
                } catch (error) {
                  telegram.hapticFeedback('notification', 'error');
                }
              }}
              className="w-full flex items-center space-x-3 p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
            >
              <Zap className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-800">Оптимизация БД</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    {/* Модальные окна */}
    {showBroadcastModal && (
      <BroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        onSend={sendBroadcastNotification}
      />
    )}

    {showNotificationManager && (
      <NotificationManager
        isOpen={showNotificationManager}
        onClose={() => setShowNotificationManager(false)}
        history={notificationHistory}
        templates={notificationTemplates}
        onSendBroadcast={sendBroadcastNotification}
      />
    )}

    {showLogsViewer && (
      <LogsViewer
        isOpen={showLogsViewer}
        onClose={() => setShowLogsViewer(false)}
        logs={logs}
        onRefresh={loadSystemLogs}
      />
    )}

    {showBackupManager && (
      <BackupManager
        isOpen={showBackupManager}
        onClose={() => setShowBackupManager(false)}
        backups={backups}
        onCreateBackup={createBackup}
        onRefresh={loadBackupHistory}
      />
    )}
  </div>
);
const NotificationManager = ({ isOpen, onClose, history, templates, onSendBroadcast }: any) => {
  const [activeTab, setActiveTab] = useState<'history' | 'templates' | 'broadcast'>('history');
  const [newTemplate, setNewTemplate] = useState({ name: '', title: '', message: '', type: 'general' });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Управление уведомлениями</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-4 mt-4">
            {[
              { id: 'history', name: 'История', icon: Clock },
              { id: 'templates', name: 'Шаблоны', icon: MessageSquare },
              { id: 'broadcast', name: 'Рассылка', icon: Send }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-96">
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">История уведомлений</h3>
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">История уведомлений пуста</p>
              ) : (
                <div className="space-y-3">
                  {history.map((notification: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{notification.title}</h4>
                        <span className="text-xs text-gray-500">
                          {new Date(notification.sent_at).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Получателей: {notification.recipients_count}</span>
                        <span className={`px-2 py-1 rounded-full ${
                          notification.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {notification.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Шаблоны уведомлений</h3>
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                  Новый шаблон
                </button>
              </div>
              
              {templates.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Шаблоны отсутствуют</p>
              ) : (
                <div className="grid gap-4">
                  {templates.map((template: any, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <div className="flex space-x-2">
                          <button className="text-blue-600 hover:text-blue-900">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="text-red-600 hover:text-red-900">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{template.title}</p>
                      <p className="text-xs text-gray-500">{template.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'broadcast' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Новая рассылка</h3>
              <BroadcastForm onSubmit={onSendBroadcast} templates={templates} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// 🔥 КОМПОНЕНТ ПРОСМОТРА ЛОГОВ
const LogsViewer = ({ isOpen, onClose, logs, onRefresh }: any) => {
  const [logLevel, setLogLevel] = useState('INFO');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = logs.filter((log: any) => 
    log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.module.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl w-full max-w-6xl max-h-[80vh] overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Системные логи</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Поиск в логах..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={logLevel}
              onChange={(e) => {
                setLogLevel(e.target.value);
                onRefresh(e.target.value);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
            <button
              onClick={() => onRefresh(logLevel)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Обновить
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-96">
          <div className="space-y-2">
            {filteredLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Логи не найдены</p>
            ) : (
              filteredLogs.map((log: any, index: number) => (
                <div key={index} className={`p-3 rounded-lg text-sm font-mono ${
                  log.level === 'ERROR' || log.level === 'CRITICAL' ? 'bg-red-50 border border-red-200' :
                  log.level === 'WARNING' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-gray-50 border border-gray-200'
                }`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      log.level === 'ERROR' || log.level === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      log.level === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                      log.level === 'INFO' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(log.timestamp).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <div className="text-gray-800">{log.message}</div>
                  <div className="text-gray-500 text-xs mt-1">{log.module}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// 🔥 КОМПОНЕНТ УПРАВЛЕНИЯ РЕЗЕРВНЫМИ КОПИЯМИ
const BackupManager = ({ isOpen, onClose, backups, onCreateBackup, onRefresh }: any) => {
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      await onCreateBackup();
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">Резервные копии</h2>
            <div className="flex space-x-3">
              <button
                onClick={handleCreateBackup}
                disabled={isCreating}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Создание...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Создать копию</span>
                  </>
                )}
              </button>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-96">
          {backups.length === 0 ? (
            <div className="text-center py-12">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">Резервные копии отсутствуют</h3>
              <p className="text-gray-500 mb-6">Создайте первую резервную копию для защиты данных</p>
            </div>
          ) : (
            <div className="space-y-4">
              {backups.map((backup: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-1">{backup.filename}</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Размер: {backup.size}</p>
                        <p>Создано: {new Date(backup.created_at).toLocaleString('ru-RU')}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          // TODO: Implement download
                          console.log('Download backup:', backup.id);
                        }}
                        className="text-blue-600 hover:text-blue-900 p-2"
                        title="Скачать"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Удалить эту резервную копию?')) {
                            // TODO: Implement delete
                            console.log('Delete backup:', backup.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-900 p-2"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      backup.status === 'completed' ? 'bg-green-100 text-green-800' :
                      backup.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {backup.status === 'completed' ? 'Завершено' :
                       backup.status === 'in_progress' ? 'В процессе' : 'Ошибка'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// 🔥 УЛУЧШЕННАЯ ФОРМА РАССЫЛКИ
const BroadcastForm = ({ onSubmit, templates }: any) => {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    target: 'all',
    template_id: '',
    schedule: false,
    schedule_date: '',
    schedule_time: ''
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t: any) => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title,
        message: template.message,
        template_id: templateId
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
      template_id: '',
      schedule: false,
      schedule_date: '',
      schedule_time: ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Шаблон */}
      {templates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Использовать шаблон
          </label>
          <select
            value={formData.template_id}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Выберите шаблон (необязательно)</option>
            {templates.map((template: any) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
        <p className="text-xs text-gray-500 mt-1">
          {formData.message.length}/500 символов
        </p>
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
              <label className="block text-xs text-gray-600 mb-1">Дата</label>
              <input
                type="date"
                value={formData.schedule_date}
                onChange={(e) => setFormData(prev => ({ ...prev, schedule_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Время</label>
              <input
                type="time"
                value={formData.schedule_time}
                onChange={(e) => setFormData(prev => ({ ...prev, schedule_time: e.target.value }))}
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
          onClick={() => {
            // Preview functionality
            console.log('Preview notification:', formData);
          }}
        >
          Предпросмотр
        </button>
        <button
          type="submit"
          disabled={!formData.title || !formData.message}
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {formData.schedule ? 'Запланировать' : 'Отправить'}
        </button>
      </div>
    </form>
  );
};

useEffect(() => {
  if (activeTab === 'settings' && isAuthorized) {
    loadSystemSettings();
  } else if (activeTab === 'users' && isAuthorized) {
    loadUsers();
  } else if (activeTab === 'analytics' && isAuthorized) {
    loadAnalytics();
  }
}, [activeTab, isAuthorized, loadSystemSettings, loadUsers, loadAnalytics]);



  // 🔥 ПРОВЕРКА АВТОРИЗАЦИИ
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка доступа...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Доступ запрещен</h2>
          <p className="text-gray-600 mb-6">
            У вас нет прав администратора для доступа к этой панели.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  // 🔥 ОСНОВНОЙ РЕНДЕР
  return (
  <div className="min-h-screen bg-gray-50 tg-admin-panel">
    {/* Header */}
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
              Админ-панель AITU
            </h1>
            <p className="text-sm text-gray-600 hidden sm:block">
              Управление системой тестирования
            </p>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button 
              onClick={async () => {
                try {
                  await loadDashboardStats();
                  telegram.hapticFeedback('impact', 'light');
                } catch (error) {
                  telegram.hapticFeedback('notification', 'error');
                }
              }}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 admin-touch-button"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 admin-touch-button">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Navigation Tabs - Мобильная адаптация */}
<div className="bg-white border-b border-gray-200">
  <div className="px-4 sm:px-6">
    {/* Desktop Navigation */}
    <nav className="hidden md:flex space-x-8">
      {[
        { id: 'dashboard', name: 'Дашборд', icon: BarChart3 },
        { id: 'applications', name: 'Заявки', icon: FileText },
        { id: 'users', name: 'Пользователи', icon: Users },
        { id: 'tests', name: 'Тесты', icon: Globe },
        { id: 'analytics', name: 'Аналитика', icon: TrendingUp },
        { id: 'settings', name: 'Настройки', icon: Settings }
      ].map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{tab.name}</span>
          </button>
        );
      })}
    </nav>

    {/* Mobile Navigation - Horizontal Scroll */}
    <div className="md:hidden">
      <div className="flex overflow-x-auto scrollbar-hide py-2 space-x-4">
        {[
          { id: 'dashboard', name: 'Дашборд', icon: BarChart3, shortName: 'Дашборд' },
          { id: 'applications', name: 'Заявки', icon: FileText, shortName: 'Заявки' },
          { id: 'users', name: 'Польз.', icon: Users, shortName: 'Польз.' },
          { id: 'tests', name: 'Тесты', icon: Globe, shortName: 'Тесты' },
          { id: 'analytics', name: 'Аналитика', icon: TrendingUp, shortName: 'Анал.' },
          { id: 'settings', name: 'Настройки', icon: Settings, shortName: 'Настр.' }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center min-w-[80px] px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">{tab.shortName}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
</div>

      {/* Content */}
    <div className="admin-mobile-padding py-4 sm:p-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'applications' && renderApplications()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'tests' && renderTests()}
          {activeTab === 'analytics' && renderAnalytics()}
          {activeTab === 'settings' && renderSettings()}
        </motion.div>
      </AnimatePresence>
    </div>
  </div>
);
}

