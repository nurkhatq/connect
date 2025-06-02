const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token); // Используем auth_token везде
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token'); // Используем auth_token везде
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  // Auth endpoints
  async login(initData: string) {
    return this.request<{ access_token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ init_data: initData }),
    });
  }

  async refreshToken() {
    return this.request<{ access_token: string }>('/auth/refresh');
  }

  // User endpoints
  async getProfile() {
    return this.request<any>('/users/profile');
  }

  async updateProfile(data: any) {
    return this.request<any>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Test endpoints
  async getTests() {
    return this.request<any[]>('/tests');
  }

  async getTest(id: string) {
    return this.request<any>(`/tests/${id}`);
  }

  async startTest(testId: string) {
    return this.request<any>(`/tests/${testId}/start`, {
      method: 'POST',
    });
  }

  async submitAnswer(sessionId: string, questionId: string, answer: string) {
    return this.request<any>(`/tests/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, answer }),
    });
  }

  async completeTest(sessionId: string) {
    return this.request<any>(`/tests/sessions/${sessionId}/complete`, {
      method: 'POST',
    });
  }

  // Application endpoints
  async submitApplication(data: any) {
    return this.request<any>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApplications() {
    return this.request<any[]>('/applications');
  }

  async uploadDocument(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}/applications/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  // Notification endpoints
  async getNotifications() {
    return this.request<any[]>('/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead() {
    return this.request<any>('/notifications/mark-all-read', {
      method: 'PUT',
    });
  }

  // Leaderboard endpoints
  async getLeaderboard() {
    return this.request<any[]>('/users/leaderboard');
  }

  async getAchievements() {
    return this.request<any[]>('/users/achievements');
  }

  // Health check
  async ping() {
    return this.request<any>('/health');
  }
}

export const api = new ApiClient(API_BASE_URL);
