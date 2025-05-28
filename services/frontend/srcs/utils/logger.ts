interface LogEntry {
  service: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
}

class Logger {
  private baseUrl: string;
  private serviceName: string;
  private isEnabled: boolean;

  constructor(serviceName: string = 'frontend') {
    this.baseUrl = '/api/logs';
    this.serviceName = serviceName;
    // 本番環境では無効化することも可能
    this.isEnabled = true;
  }

  private async sendLog(level: LogEntry['level'], message: string, metadata?: Record<string, any>) {
    if (!this.isEnabled) return;

    try {
      const logEntry: LogEntry = {
        service: this.serviceName,
        level,
        message,
        metadata: {
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
          screen: {
            width: window.screen.width,
            height: window.screen.height
          },
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          ...metadata,
        },
      };

      const response = await fetch(`${this.baseUrl}/${this.serviceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });

      if (!response.ok) {
        console.warn('Failed to send log to server:', response.statusText);
      }
    } catch (error) {
      // ログ送信失敗はアプリケーションを停止させない
      console.warn('Failed to send log to server:', error);
    }
  }

  // パブリックメソッド
  debug(message: string, metadata?: Record<string, any>) {
    console.debug(`[${this.serviceName}] ${message}`, metadata);
    return this.sendLog('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>) {
    console.info(`[${this.serviceName}] ${message}`, metadata);
    return this.sendLog('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    console.warn(`[${this.serviceName}] ${message}`, metadata);
    return this.sendLog('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, any>) {
    console.error(`[${this.serviceName}] ${message}`, metadata);
    return this.sendLog('error', message, metadata);
  }

  // ページビュー関連のログ
  pageView(path: string, metadata?: Record<string, any>) {
    return this.info(`Page view: ${path}`, {
      path,
      category: 'navigation',
      referrer: document.referrer,
      title: document.title,
      ...metadata
    });
  }

  // ゲーム関連のログ
  gameEvent(eventType: string, data?: Record<string, any>) {
    return this.info(`Game event: ${eventType}`, {
      eventType,
      gameData: data,
      category: 'game'
    });
  }

  // ユーザーアクション関連のログ
  userAction(action: string, data?: Record<string, any>) {
    return this.info(`User action: ${action}`, {
      action,
      userData: data,
      category: 'user'
    });
  }

  // パフォーマンス関連のログ
  performance(metric: string, value: number, unit: string = 'ms') {
    return this.info(`Performance: ${metric}`, {
      metric,
      value,
      unit,
      category: 'performance'
    });
  }

  // エラートラッキング
  exception(error: Error, metadata?: Record<string, any>) {
    return this.error(`Exception: ${error.message}`, {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      category: 'exception',
      ...metadata
    });
  }

  // インタラクション追跡
  interaction(element: string, action: string, metadata?: Record<string, any>) {
    return this.info(`Interaction: ${action} on ${element}`, {
      element,
      action,
      category: 'interaction',
      ...metadata
    });
  }

  // ログ無効化/有効化
  disable() {
    this.isEnabled = false;
  }

  enable() {
    this.isEnabled = true;
  }
}

// シングルトンインスタンス
export const logger = new Logger('frontend');

// ゲーム専用ロガー
export const gameLogger = new Logger('game');

// 認証専用ロガー
export const authLogger = new Logger('auth');

export default logger;
