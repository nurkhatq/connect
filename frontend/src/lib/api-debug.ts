// Исправленная версия API клиента
class DebugAPI {
  private baseURL: string;

  constructor() {
    this.baseURL = this.detectApiUrl();
    console.log('🔧 API Debug - Using URL:', this.baseURL);
  }

  private detectApiUrl(): string {
    if (typeof window === 'undefined') return 'https://connect-aitu.me/api';
    
    const { protocol, hostname } = window.location;
    console.log('🌐 Location info:', { protocol, hostname });
    
    // Если открыто через Telegram WebApp
    if (hostname === 'connect-aitu.me') {
      return `${protocol}//connect-aitu.me/api`;
    }
    
    return '/api';
  }

  async ping(): Promise<any> {
    const urls = [
      `${this.baseURL}/ping`,
      '/api/ping',
      'https://connect-aitu.me/api/ping'
    ];

    for (const url of urls) {
      try {
        console.log(`🧪 Trying: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`📊 Response for ${url}:`, response.status, response.statusText);

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Success with ${url}:`, data);
          return { url, data };
        }
      } catch (error) {
        console.log(`❌ Failed ${url}:`, error);
      }
    }

    throw new Error('All API endpoints failed');
  }

  async login(initData: string): Promise<any> {
    // ИСПРАВЛЕНО: Правильный endpoint /auth/login
    const url = `${this.baseURL}/auth/login`;
    console.log('🔐 Login request to:', url);
    console.log('📤 Sending initData length:', initData.length);
    console.log('📤 First 100 chars:', initData.substring(0, 100));
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // ИСПРАВЛЕНО: Правильный формат данных
        body: JSON.stringify({ 
          init_data: initData 
        }),
      });

      console.log('📊 Login response:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Login error response:', errorText);
        
        // Попробуем распарсить как JSON для детальной ошибки
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Login error details:', errorJson);
          throw new Error(`Login failed: ${response.status} - ${errorJson.detail || errorText}`);
        } catch {
          throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('✅ Login success:', data);
      return data;
      
    } catch (error) {
      console.error('❌ Login request failed:', error);
      throw error;
    }
  }

  // Тестирование с реальными Telegram данными
  async testLoginWithRealData(): Promise<any> {
    // Получаем реальные данные от Telegram
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const realInitData = window.Telegram.WebApp.initData;
      console.log('🔍 Real Telegram initData:', realInitData);
      
      if (realInitData && realInitData.length > 0) {
        return this.login(realInitData);
      } else {
        throw new Error('No real Telegram initData available');
      }
    } else {
      throw new Error('Telegram WebApp not available');
    }
  }
}

export const debugApi = new DebugAPI();
