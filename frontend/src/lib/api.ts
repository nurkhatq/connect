// frontend/src/lib/api.ts - ПОЛНЫЙ ИСПРАВЛЕННЫЙ ФАЙЛ

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://connect-aitu.me/api';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    console.log('🔧 API Client initialized with base URL:', baseUrl);
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
    console.log('🔑 Token set successfully');
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryOnUnauth: boolean = true
  ): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${this.baseUrl}/${cleanEndpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'same-origin',
      });

      // Если 401 и это первая попытка, пробуем обновить токен
      if (response.status === 401 && retryOnUnauth && endpoint !== 'auth/login') {
        console.log('🔄 Got 401, attempting token refresh...');
        
        // Пробуем обновить токен
        const refreshSuccess = await this.attemptTokenRefresh();
        if (refreshSuccess) {
          // Повторяем запрос с новым токеном (без retry)
          return this.request(endpoint, options, false);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('🚨 Request failed:', error);
      throw error;
    }
  }

  private async attemptTokenRefresh(): Promise<boolean> {
    try {
      // Сначала пробуем refresh token
      const refreshResponse = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        this.setToken(data.access_token);
        return true;
      }

      // Если refresh не работает, пробуем re-login
      if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const initData = window.Telegram.WebApp.initData;
        if (initData) {
          const loginResponse = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ init_data: initData })
          });

          if (loginResponse.ok) {
            const data = await loginResponse.json();
            this.setToken(data.access_token);
            console.log('✅ Auto re-login successful');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return false;
    }
  }

  // Auth endpoints
  async login(initData: string) {
    console.log('🔐 Starting login process...');
    return this.request<{ access_token: string; user: any }>('auth/login', {
      method: 'POST',
      body: JSON.stringify({ init_data: initData }),
    }, false); // Не пытаемся обновить токен при логине
  }

  async refreshToken() {
    return this.request<{ access_token: string }>('auth/refresh', {
      method: 'POST',
    }, false);
  }

  // User endpoints
  async getProfile() {
    return this.request<any>('users/profile');
  }

  // Test endpoints
  async getTests() {
    return this.request<any[]>('tests');
  }

  async getTest(id: string) {
    return this.request<any>(`tests/${id}`);
  }

  async startTest(testId: string) {
    return this.request<any>(`tests/${testId}/start`, {
      method: 'POST',
    });
  }

  async submitAnswer(sessionId: string, questionId: string, answer: string) {
    return this.request<any>(`tests/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, answer }),
    });
  }

  async completeTest(sessionId: string) {
    return this.request<any>(`tests/sessions/${sessionId}/complete`, {
      method: 'POST',
    });
  }

  // 🔥 APPLICATION ENDPOINTS - ИСПРАВЛЕНО!
  async uploadDocument(file: File) {
    console.log('📁 Uploading document:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    // Проверка размера файла (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error(`Файл "${file.name}" слишком большой. Максимальный размер: ${maxSize / (1024 * 1024)}MB`);
    }
    
    // Проверка типа файла
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error('Неподдерживаемый тип файла. Разрешены: PDF, JPG, PNG, DOC, DOCX');
      }
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${this.baseUrl}/applications/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          // 🔥 НЕ устанавливаем Content-Type для FormData - браузер сделает это автоматически!
        },
        body: formData,
        mode: 'cors',
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', response.status, errorText);
        throw new Error(`Ошибка загрузки (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Document uploaded successfully:', result);
      return result;
      
    } catch (error: any) {
      console.error('❌ Document upload failed:', error);
      throw error;
    }
  }

  async submitApplication(applicationData: any) {
    console.log('📋 Submitting application:', applicationData);
    
    try {
      const response = await this.request<any>('applications', {
        method: 'POST',
        body: JSON.stringify(applicationData),
      });
      
      console.log('✅ Application submitted successfully:', response);
      return response;
      
    } catch (error: any) {
      console.error('❌ Application submission failed:', error);
      throw error;
    }
  }

  async getApplications() {
    console.log('📄 Getting user applications...');
    
    try {
      const applications = await this.request<any[]>('applications');
      console.log('✅ Applications loaded:', applications.length);
      return applications;
      
    } catch (error: any) {
      console.error('❌ Failed to load applications:', error);
      throw error;
    }
  }

  async getApplication(applicationId: string) {
    console.log('📄 Getting application details:', applicationId);
    
    try {
      const application = await this.request<any>(`applications/${applicationId}`);
      console.log('✅ Application details loaded:', application);
      return application;
      
    } catch (error: any) {
      console.error('❌ Failed to load application details:', error);
      throw error;
    }
  }

  // Notification endpoints
  async getNotifications() {
    return this.request<any[]>('notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  // Leaderboard
  async getLeaderboard() {
    return this.request<any[]>('users/leaderboard');
  }
// 🔥 ДОБАВИТЬ В КОНЕЦ класса ApiClient в frontend/src/lib/api.ts:

// 🔥 ADMIN ENDPOINTS
async getAdminStats() {
  console.log('📊 Getting admin stats...');
  return this.request<any>('admin/stats');
}

async getAdminApplications(params: {
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
} = {}) {
  console.log('📄 Getting admin applications with params:', params);
  
  // Устанавливаем дефолтные значения
  const queryParams = new URLSearchParams();
  
  // Добавляем параметры только если они заданы и не пустые
  if (params.status && params.status !== 'all') {
    queryParams.append('status', params.status);
  }
  if (params.search && params.search.trim()) {
    queryParams.append('search', params.search.trim());
  }
  if (params.sortBy) {
    queryParams.append('sort_by', params.sortBy);
  }
  if (params.sortOrder) {
    queryParams.append('sort_order', params.sortOrder);
  }
  if (params.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params.offset) {
    queryParams.append('offset', params.offset.toString());
  }
  if (params.dateFrom) {
    queryParams.append('date_from', params.dateFrom);
  }
  if (params.dateTo) {
    queryParams.append('date_to', params.dateTo);
  }
  
  const queryString = queryParams.toString();
  const endpoint = queryString ? `admin/applications?${queryString}` : 'admin/applications';
  
  return this.request<{
    applications: any[];
    total: number;
    offset: number;
    limit: number;
    filters: any;
  }>(endpoint);
}
async getAdminApplicationsSimple(status?: string, limit = 50, offset = 0) {
  console.log('📄 Getting admin applications (simple)...');
  
  try {
    // Сначала пробуем admin endpoint
    return await this.getAdminApplications({ status, limit, offset });
  } catch (error) {
    console.log('⚠️ Admin applications endpoint failed, trying regular applications...');
    
    // Если admin endpoint не работает, используем обычный
    const applications = await this.getApplications();
    
    // Фильтруем по статусу если нужно
    const filteredApps = status && status !== 'all' 
      ? applications.filter((app: any) => app.status === status)
      : applications;
    
    // Применяем pagination
    const paginatedApps = filteredApps.slice(offset, offset + limit);
    
    // Возвращаем в формате admin endpoint
    return {
      applications: paginatedApps.map((app: any) => ({
        ...app,
        user: {
          id: app.user_id || 'unknown',
          telegram_id: 0,
          first_name: 'Unknown',
          last_name: 'User',
          username: 'unknown',
          level: 1,
          points: 0
        }
      })),
      total: filteredApps.length,
      offset,
      limit,
      filters: { status, search: '', sort_by: 'created_at', sort_order: 'desc' }
    };
  }
}
async updateApplicationStatus(applicationId: string, status: string, adminNotes = '') {
  console.log(`📝 Updating application ${applicationId} to ${status}`);
  
  try {
    // Пробуем admin endpoint
    return await this.request<any>(`admin/applications/${applicationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status, 
        admin_notes: adminNotes 
      }),
    });
  } catch (error) {
    console.log('⚠️ Admin update endpoint failed, trying direct applications endpoint...');
    
    // Если admin endpoint не работает, используем прямой
    return await this.request<any>(`applications/${applicationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ 
        status, 
        admin_notes: adminNotes 
      }),
    });
  }
}

async getAdminUsers(limit = 50, offset = 0, search?: string) {
  console.log('👥 Getting admin users...');
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (search) params.append('search', search);
  
  return this.request<any>(`admin/users?${params}`);
}

async getAdminApplicationDetail(applicationId: string) {
  console.log(`📄 Getting application details: ${applicationId}`);
  return this.request<any>(`admin/applications/${applicationId}`);
}
// Добавьте эти методы в класс ApiClient в frontend/src/lib/api.ts

// 🔥 РАСШИРЕННЫЕ ADMIN ENDPOINTS

// Dashboard и аналитика
async getDashboardStats(period: string = '7d') {
  console.log(`📊 Getting dashboard stats for period: ${period}`);
  return this.request<any>(`admin/dashboard?period=${period}`);
}



// Расширенное управление заявками
async getAdminApplicationsAdvanced(params: {
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  console.log('📄 Getting admin applications with advanced filters...');
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      queryParams.append(key, value.toString());
    }
  });
  
  return this.request<any>(`admin/applications?${queryParams}`);
}

async bulkUpdateApplications(applicationIds: string[], status: string, adminNotes?: string) {
  console.log(`📝 Bulk updating ${applicationIds.length} applications to ${status}`);
  
  try {
    // Пробуем admin bulk endpoint
    return await this.request<any>('admin/applications/bulk-update', {
      method: 'PUT',
      body: JSON.stringify({
        application_ids: applicationIds,
        status,
        admin_notes: adminNotes || ''
      }),
    });
  } catch (error) {
    console.log('⚠️ Admin bulk update failed, updating individually...');
    
    // Если bulk не работает, обновляем по одной
    const results = [];
    for (const appId of applicationIds) {
      try {
        const result = await this.updateApplicationStatus(appId, status, adminNotes);
        results.push(result);
      } catch (individualError) {
        console.error(`Failed to update application ${appId}:`, individualError);
      }
    }
    
    return {
      message: `Updated ${results.length} of ${applicationIds.length} applications`,
      updated_count: results.length,
      status
    };
  }
}


// Управление тестами
async getAdminTests() {
  console.log('📝 Getting admin tests...');
  return this.request<any>('admin/tests');
}



// Экспорт данных
async exportApplications(format: 'csv' | 'json', status?: string) {
  console.log(`📤 Exporting applications in ${format} format`);
  
  try {
    // Пробуем admin export endpoint
    const params = new URLSearchParams();
    params.append('format', format);
    if (status && status !== 'all') {
      params.append('status', status);
    }
    
    return await this.request<{
      filename: string;
      content: string;
      content_type: string;
    }>(`admin/export/applications?${params}`);
    
  } catch (error) {
    console.log('⚠️ Admin export failed, generating client-side export...');
    
    // Если server export не работает, создаем export на клиенте
    const applications = await this.getApplications();
    const filteredApps = status && status !== 'all' 
      ? applications.filter((app: any) => app.status === status)
      : applications;
    
    let content: string;
    let contentType: string;
    
    if (format === 'csv') {
      // Создаем CSV
      const headers = ['ID', 'Status', 'IIN', 'Program', 'ENT Score', 'Created At'];
      const rows = filteredApps.map((app: any) => [
        app.id,
        app.status,
        app.personal_data?.iin || '',
        app.education?.program || '',
        app.education?.ent_score || '',
        new Date(app.created_at).toLocaleDateString()
      ]);
      
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
      contentType = 'text/csv';
    } else {
      // Создаем JSON
      content = JSON.stringify(filteredApps, null, 2);
      contentType = 'application/json';
    }
    
    return {
      filename: `applications_${status || 'all'}_${new Date().toISOString().split('T')[0]}.${format}`,
      content,
      content_type: contentType
    };
  }
}




// Уведомления и массовая рассылка
async broadcastNotification(data: {
  title: string;
  message: string;
  target?: 'all' | 'active' | string; // level_X для определенного уровня
}) {
  console.log(`📢 Broadcasting notification to ${data.target || 'all'} users`);
  return this.request<any>('admin/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Системные логи


// Статистика и метрики
async getSystemMetrics() {
  console.log('📊 Getting system metrics...');
  return this.request<any>('admin/metrics');
}

async getTestAnalytics(testId?: string, period: string = '30d') {
  console.log(`📈 Getting test analytics`);
  const params = new URLSearchParams();
  params.append('period', period);
  if (testId) params.append('test_id', testId);
  
  return this.request<any>(`admin/analytics/tests?${params}`);
}

// Управление пользователями (расширенное)


async updateUserStatus(userId: string, isActive: boolean) {
  console.log(`👤 Updating user ${userId} status to ${isActive ? 'active' : 'inactive'}`);
  return this.request<any>(`admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  });
}



// Управление вопросами
async getQuestions(category?: string, difficulty?: number) {
  console.log('❓ Getting questions...');
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (difficulty) params.append('difficulty', difficulty.toString());
  
  return this.request<any>(`admin/questions?${params}`);
}

async createQuestion(questionData: {
  testCategory: string;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty?: number;
}) {
  console.log('➕ Creating new question...');
  return this.request<any>('admin/questions', {
    method: 'POST',
    body: JSON.stringify(questionData),
  });
}

async updateQuestion(questionId: string, questionData: any) {
  console.log(`✏️ Updating question ${questionId}`);
  return this.request<any>(`admin/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(questionData),
  });
}

async deleteQuestion(questionId: string) {
  console.log(`🗑️ Deleting question ${questionId}`);
  return this.request<any>(`admin/questions/${questionId}`, {
    method: 'DELETE',
  });
}

// Настройки системы

// Расширенная аналитика
async getConversionFunnel() {
  console.log('🔄 Getting conversion funnel data...');
  return this.request<any>('admin/analytics/funnel');
}

async getCohortAnalysis(period: string = '30d') {
  console.log(`👥 Getting cohort analysis for ${period}`);
  return this.request<any>(`admin/analytics/cohort?period=${period}`);
}

async getRetentionAnalysis() {
  console.log('📈 Getting retention analysis...');
  return this.request<any>('admin/analytics/retention');
}

// Пользовательские отчеты


// A/B тесты и эксперименты
async getActiveExperiments() {
  console.log('🧪 Getting active experiments...');
  return this.request<any>('admin/experiments');
}
// 🔥 ДОБАВИТЬ в frontend/src/lib/api.ts (дополнительные методы):

// 🔥 СИСТЕМНЫЕ НАСТРОЙКИ
async getSystemSettings() {
  console.log('⚙️ Getting system settings...');
  return this.request<any>('admin/settings');
}

async updateSystemSettings(settings: any) {
  console.log('⚙️ Updating system settings...', settings);
  return this.request<any>('admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// 🔥 УПРАВЛЕНИЕ ТЕСТАМИ (расширенное)
async getAdminTestsDetailed() {
  console.log('📝 Getting detailed admin tests...');
  return this.request<any>('admin/tests');
}

async updateTestStatus(testId: string, isActive: boolean) {
  console.log(`✏️ Updating test ${testId} status to ${isActive}`);
  return this.request<any>(`admin/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  });
}

async updateTest(testId: string, updateData: any) {
  console.log(`✏️ Updating test ${testId}`, updateData);
  return this.request<any>(`admin/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });
}

async getTestsAnalytics(period: string = '30d', testId?: string) {
  console.log(`📈 Getting tests analytics for ${period}`);
  const params = new URLSearchParams();
  params.append('period', period);
  if (testId) params.append('test_id', testId);
  
  return this.request<any>(`admin/tests/analytics?${params}`);
}

// 🔥 УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (полное)
async getAdminUsersDetailed(params: {
  limit?: number;
  offset?: number;
  search?: string;
  level?: number;
  registered_after?: string;
  last_active_after?: string;
  sort_by?: string;
  sort_order?: string;
}) {
  console.log('👥 Getting detailed users list...', params);
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  
  return this.request<any>(`admin/users?${queryParams}`);
}

async updateUserStatusAdmin(userId: string, isActive: boolean) {
  console.log(`👤 Updating user ${userId} status to ${isActive ? 'active' : 'inactive'}`);
  return this.request<any>(`admin/users/${userId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive }),
  });
}

async getUserDetails(userId: string) {
  console.log(`👤 Getting user details: ${userId}`);
  return this.request<any>(`admin/users/${userId}`);
}

// 🔥 АНАЛИТИКА И ОТЧЕТЫ
async getUsersAnalytics(period: string = '30d') {
  console.log(`👥 Getting users analytics for period: ${period}`);
  return this.request<any>(`admin/analytics/users?period=${period}`);
}

async getSystemStatus() {
  console.log('🔍 Getting system status...');
  return this.request<any>('admin/system/status');
}

// 🔥 ЭКСПОРТ ДАННЫХ (расширенный)
async exportUsers(format: 'csv' | 'json' | 'xlsx') {
  console.log(`📤 Exporting users in ${format} format`);
  return this.request<{
    filename: string;
    content: string;
    content_type: string;
  }>(`admin/export/users?format=${format}`);
}

async exportTestResults(format: 'csv' | 'json', testId?: string) {
  console.log(`📤 Exporting test results in ${format} format`);
  const params = new URLSearchParams();
  params.append('format', format);
  if (testId) params.append('test_id', testId);
  
  return this.request<{
    filename: string;
    content: string;
    content_type: string;
  }>(`admin/export/test-results?${params}`);
}

// 🔥 РЕЗЕРВНОЕ КОПИРОВАНИЕ
async createBackup() {
  console.log('💾 Creating system backup...');
  return this.request<any>('admin/backup', {
    method: 'POST',
  });
}

async getBackupHistory() {
  console.log('📋 Getting backup history...');
  return this.request<any>('admin/backup/history');
}

async downloadBackup(backupId: string) {
  console.log(`💾 Downloading backup: ${backupId}`);
  return this.request<any>(`admin/backup/${backupId}/download`);
}

async deleteBackup(backupId: string) {
  console.log(`🗑️ Deleting backup: ${backupId}`);
  return this.request<any>(`admin/backup/${backupId}`, {
    method: 'DELETE',
  });
}

// 🔥 ЛОГИ И МОНИТОРИНГ
async getSystemLogs(params: {
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  limit?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
}) {
  console.log('📋 Getting system logs', params);
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  
  return this.request<any>(`admin/logs?${queryParams}`);
}

async getPerformanceMetrics() {
  console.log('📊 Getting performance metrics...');
  return this.request<any>('admin/performance');
}

async getDatabaseStats() {
  console.log('🗄️ Getting database statistics...');
  return this.request<any>('admin/database/stats');
}

// 🔥 УВЕДОМЛЕНИЯ И РАССЫЛКИ (расширенные)
async broadcastNotificationAdvanced(data: {
  title: string;
  message: string;
  target: string;
  schedule?: boolean;
  schedule_date?: string;
  schedule_time?: string;
  template_id?: string;
}) {
  console.log('📢 Broadcasting advanced notification', data);
  return this.request<any>('admin/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async getNotificationTemplates() {
  console.log('📋 Getting notification templates...');
  return this.request<any>('admin/notifications/templates');
}

async createNotificationTemplate(template: {
  name: string;
  title: string;
  message: string;
  type: string;
  variables: string[];
}) {
  console.log('➕ Creating notification template', template);
  return this.request<any>('admin/notifications/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

async updateNotificationTemplate(templateId: string, template: any) {
  console.log(`✏️ Updating notification template ${templateId}`);
  return this.request<any>(`admin/notifications/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(template),
  });
}

async deleteNotificationTemplate(templateId: string) {
  console.log(`🗑️ Deleting notification template ${templateId}`);
  return this.request<any>(`admin/notifications/templates/${templateId}`, {
    method: 'DELETE',
  });
}

async getNotificationHistory() {
  console.log('📋 Getting notification history...');
  return this.request<any>('admin/notifications/history');
}

async getNotificationStats() {
  console.log('📊 Getting notification statistics...');
  return this.request<any>('admin/notifications/stats');
}

// 🔥 БЕЗОПАСНОСТЬ И АУДИТ
async getAuditLog(params: {
  action?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}) {
  console.log('🔍 Getting audit log...', params);
  const queryParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      queryParams.append(key, value.toString());
    }
  });
  
  return this.request<any>(`admin/audit?${queryParams}`);
}

async getSecurityReport() {
  console.log('🛡️ Getting security report...');
  return this.request<any>('admin/security/report');
}

async getFailedLoginAttempts() {
  console.log('🔐 Getting failed login attempts...');
  return this.request<any>('admin/security/failed-logins');
}

// 🔥 ИНТЕГРАЦИИ
async getTelegramBotStatus() {
  console.log('🤖 Getting Telegram bot status...');
  return this.request<any>('admin/telegram/status');
}

async sendTestTelegramMessage(userId: string, message: string) {
  console.log(`🧪 Sending test Telegram message to user ${userId}`);
  return this.request<any>('admin/telegram/test-message', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, message }),
  });
}

async updateTelegramBotSettings(settings: any) {
  console.log('🤖 Updating Telegram bot settings...');
  return this.request<any>('admin/telegram/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// 🔥 ОТЧЕТЫ И АНАЛИТИКА (продвинутые)
async generateCustomReport(reportConfig: {
  type: 'users' | 'applications' | 'tests' | 'performance';
  date_from: string;
  date_to: string;
  filters?: any;
  format: 'json' | 'csv' | 'pdf';
}) {
  console.log('📊 Generating custom report', reportConfig);
  return this.request<any>('admin/reports/generate', {
    method: 'POST',
    body: JSON.stringify(reportConfig),
  });
}

async getReportHistory() {
  console.log('📋 Getting report history...');
  return this.request<any>('admin/reports/history');
}

async downloadReport(reportId: string) {
  console.log(`📊 Downloading report: ${reportId}`);
  return this.request<any>(`admin/reports/${reportId}/download`);
}

// 🔥 МАССОВЫЕ ОПЕРАЦИИ
async bulkDeleteUsers(userIds: string[]) {
  console.log(`🗑️ Bulk deleting ${userIds.length} users`);
  return this.request<any>('admin/users/bulk-delete', {
    method: 'DELETE',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

async bulkUpdateUserLevel(userIds: string[], newLevel: number) {
  console.log(`📈 Bulk updating ${userIds.length} users to level ${newLevel}`);
  return this.request<any>('admin/users/bulk-update-level', {
    method: 'PUT',
    body: JSON.stringify({ user_ids: userIds, level: newLevel }),
  });
}

async bulkAwardPoints(userIds: string[], points: number, reason: string) {
  console.log(`🏆 Bulk awarding ${points} points to ${userIds.length} users`);
  return this.request<any>('admin/users/bulk-award-points', {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds, points, reason }),
  });
}

// 🔥 УТИЛИТЫ И ИНСТРУМЕНТЫ
async clearCache(cacheType?: string) {
  console.log('🧹 Clearing cache...', cacheType);
  return this.request<any>('admin/utils/clear-cache', {
    method: 'POST',
    body: JSON.stringify({ cache_type: cacheType }),
  });
}

async rebuildSearchIndex() {
  console.log('🔄 Rebuilding search index...');
  return this.request<any>('admin/utils/rebuild-search', {
    method: 'POST',
  });
}

async testEmailSending(email: string, testType: string = 'basic') {
  console.log(`📧 Testing email sending to ${email}`);
  return this.request<any>('admin/utils/test-email', {
    method: 'POST',
    body: JSON.stringify({ email, test_type: testType }),
  });
}

async optimizeDatabase() {
  console.log('⚡ Optimizing database...');
  return this.request<any>('admin/utils/optimize-db', {
    method: 'POST',
  });
}

// 🔥 КОНФИГУРАЦИЯ И MAINTENANCE
async setMaintenanceMode(enabled: boolean, message?: string) {
  console.log(`🔧 Setting maintenance mode to ${enabled}`);
  return this.request<any>('admin/maintenance', {
    method: 'PUT',
    body: JSON.stringify({ enabled, message }),
  });
}

async getMaintenanceStatus() {
  console.log('🔧 Getting maintenance status...');
  return this.request<any>('admin/maintenance');
}

async scheduleMaintenanceWindow(startTime: string, endTime: string, reason: string) {
  console.log('⏰ Scheduling maintenance window...');
  return this.request<any>('admin/maintenance/schedule', {
    method: 'POST',
    body: JSON.stringify({ start_time: startTime, end_time: endTime, reason }),
  });
}
async createExperiment(experimentData: {
  name: string;
  description: string;
  variants: any[];
  targetPercentage: number;
}) {
  console.log(`🧪 Creating experiment: ${experimentData.name}`);
  return this.request<any>('admin/experiments', {
    method: 'POST',
    body: JSON.stringify(experimentData),
  });
}

async getExperimentResults(experimentId: string) {
  console.log(`📊 Getting experiment results: ${experimentId}`);
  return this.request<any>(`admin/experiments/${experimentId}/results`);
}
  // Health checks
  async ping() {
    return this.request<any>('ping');
  }

  async getHealth() {
    return this.request<any>('health');
  }
}

export const api = new ApiClient(API_BASE_URL);