declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: any;
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: any;
        ready(): void;
        expand(): void;
        close(): void;
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
        MainButton: {
          setText(text: string): void;
          onClick(callback: () => void): void;
          show(): void;
          hide(): void;
        };
        BackButton: {
          onClick(callback: () => void): void;
          show(): void;
          hide(): void;
        };
      };
    };
  }
}

export class TelegramWebApp {
  private static instance: TelegramWebApp;
  private webApp: any = null;
  private readyPromise: Promise<void> | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    this.readyPromise = new Promise((resolve) => {
      // Проверяем немедленно
      if (window.Telegram?.WebApp) {
        this.setupWebApp();
        resolve();
        return;
      }

      // Слушаем событие загрузки
      window.addEventListener('telegram-web-app-loaded', () => {
        if (window.Telegram?.WebApp) {
          this.setupWebApp();
          resolve();
        }
      });

      // Fallback - проверяем каждые 100ms в течение 5 секунд
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.Telegram?.WebApp) {
          this.setupWebApp();
          clearInterval(checkInterval);
          resolve();
        } else if (attempts >= 50) { // 5 секунд
          clearInterval(checkInterval);
          console.warn('⚠️ Telegram WebApp SDK not found');
          this.createFallback();
          resolve();
        }
      }, 100);
    });
  }

  private setupWebApp() {
    if (this.webApp) return; // Уже настроен

    try {
      this.webApp = window.Telegram!.WebApp;
      this.webApp.ready();
      this.webApp.expand();
      
      console.log('✅ Telegram WebApp initialized');
      
    } catch (error) {
      console.error('❌ Error setting up Telegram WebApp:', error);
      this.createFallback();
    }
  }

  private createFallback() {
    console.log('🔧 Creating fallback WebApp for development');
    this.webApp = {
      initData: '',
      initDataUnsafe: { user: null },
      platform: 'unknown',
      version: '6.0',
      colorScheme: 'light',
      ready: () => {},
      expand: () => {},
      close: () => {},
      HapticFeedback: {
        impactOccurred: () => {},
        notificationOccurred: () => {},
        selectionChanged: () => {}
      },
      MainButton: {
        setText: () => {},
        onClick: () => {},
        show: () => {},
        hide: () => {}
      },
      BackButton: {
        onClick: () => {},
        show: () => {},
        hide: () => {}
      }
    };
  }

  public static getInstance(): TelegramWebApp {
    if (!TelegramWebApp.instance) {
      TelegramWebApp.instance = new TelegramWebApp();
    }
    return TelegramWebApp.instance;
  }

  // Добавляем waitForReady метод
  public async waitForReady(): Promise<void> {
    if (this.readyPromise) {
      await this.readyPromise;
    }
  }

  public getInitData(): string {
    return this.webApp?.initData || '';
  }

  public getUser(): any {
    return this.webApp?.initDataUnsafe?.user || null;
  }

  public getTheme(): 'light' | 'dark' {
    return this.webApp?.colorScheme || 'light';
  }

  public getPlatform(): string {
    return this.webApp?.platform || 'unknown';
  }

  public getVersion(): string {
    return this.webApp?.version || '6.0';
  }

  public hapticFeedback(type: 'impact' | 'notification' | 'selection', style?: string): void {
    if (!this.webApp?.HapticFeedback) return;
    
    try {
      switch (type) {
        case 'impact':
          this.webApp.HapticFeedback.impactOccurred(style || 'medium');
          break;
        case 'notification':
          this.webApp.HapticFeedback.notificationOccurred(style || 'success');
          break;
        case 'selection':
          this.webApp.HapticFeedback.selectionChanged();
          break;
      }
    } catch (error) {
      // Игнорируем ошибки haptic feedback
    }
  }

  public isReady(): boolean {
    return !!this.webApp;
  }

  public close(): void {
    this.webApp?.close();
  }
}

export const telegram = TelegramWebApp.getInstance();
