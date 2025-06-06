// frontend/src/lib/auth.ts - Утилиты для автоматического обновления токена
import { api } from './api';
import { telegram } from './telegram';

export class AuthManager {
  private static instance: AuthManager;
  private refreshTimeout: NodeJS.Timeout | null = null;

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  // Проверяет истекает ли токен и обновляет его
  async checkAndRefreshToken(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    try {
      // Парсим токен чтобы проверить время истечения
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp;
      const now = Math.floor(Date.now() / 1000);
      
      // Если токен истекает в течение 5 минут, обновляем
      if (exp - now < 300) {
        console.log('🔄 Token expires soon, refreshing...');
        return await this.refreshToken();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Token validation error:', error);
      return false;
    }
  }

  // Обновляет токен через refresh endpoint
  async refreshToken(): Promise<boolean> {
    try {
      const response = await api.refreshToken();
      api.setToken(response.access_token);
      console.log('✅ Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return await this.reLogin();
    }
  }

  // Повторный логин через Telegram
  async reLogin(): Promise<boolean> {
    try {
      await telegram.waitForReady();
      const initData = telegram.getInitData();
      
      if (!initData) {
        console.error('❌ No Telegram init data for re-login');
        return false;
      }

      const response = await api.login(initData);
      api.setToken(response.access_token);
      console.log('✅ Re-login successful');
      return true;
    } catch (error) {
      console.error('❌ Re-login failed:', error);
      this.logout();
      return false;
    }
  }

  // Выход из системы (обновленный для красивой анимации)
  logout() {
    // Вместо прямого перенаправления используем красивую страницу logout
    window.location.href = '/logout';
  }

  // Прямой logout без анимации (для экстренных случаев)
  logoutImmediate() {
    this.stopTokenRefreshTimer();
    localStorage.removeItem('auth_token');
    sessionStorage.clear();
    window.location.href = '/login';
  }

  // Устанавливает автоматическую проверку токена
  startTokenRefreshTimer() {
    if (this.refreshTimeout) {
      clearInterval(this.refreshTimeout);
    }

    // Проверяем токен каждые 10 минут
    this.refreshTimeout = setInterval(() => {
      this.checkAndRefreshToken();
    }, 10 * 60 * 1000);
  }

  stopTokenRefreshTimer() {
    if (this.refreshTimeout) {
      clearInterval(this.refreshTimeout);
      this.refreshTimeout = null;
    }
  }
}

export const authManager = AuthManager.getInstance();
