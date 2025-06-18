// Online status management utility with user activity detection
export class OnlineStatusManager {
  private static instance: OnlineStatusManager;
  private isInitialized = false;
  private heartbeatInterval: number | null = null;
  private activityTimeoutInterval: number | null = null;
  private lastActivityTime: number = Date.now();
  private isCurrentlyOnline = false;
  
  // 設定値
  private readonly HEARTBEAT_INTERVAL = 10000; // 10秒間隔でheartbeat
  private readonly ACTIVITY_TIMEOUT = 60000; // 60秒間アクティビティがない場合はオフライン
  private readonly STATUS_UPDATE_DEBOUNCE = 2000; // ステータス更新の間隔制限

  private constructor() {}

  public static getInstance(): OnlineStatusManager {
    if (!OnlineStatusManager.instance) {
      OnlineStatusManager.instance = new OnlineStatusManager();
    }
    return OnlineStatusManager.instance;
  }

  public initialize() {
    if (this.isInitialized) {
      return;
    }

    // 認証トークンがある場合のみオンライン状態管理を開始
    const token = localStorage.getItem('authToken');
    if (!token) {
      console.log('No auth token found, skipping online status management');
      return;
    }

    // トークンの有効性をチェック
    if (!this.isTokenValid(token)) {
      console.log('Invalid or expired token found, cleaning up');
      localStorage.removeItem('authToken');
      return;
    }

    // ページ読み込み時にオンライン状態を設定
    this.setOnlineStatus(true);

    // ユーザーアクティビティイベントを設定
    this.setupActivityListeners();

    // 定期的なheartbeatを開始
    this.startHeartbeat();

    // アクティビティタイムアウト監視を開始
    this.startActivityTimeout();

    // ページ離脱時にオフライン状態を設定
    window.addEventListener('beforeunload', () => {
      this.setOnlineStatus(false, true); // 同期的に送信
    });

    this.isInitialized = true;
    console.log('Online status management initialized with activity detection');
  }

  private setupActivityListeners() {
    const activityEvents = [
      'click',
      'keydown',
      'keypress',
      'mousemove',
      'mousedown',
      'mouseup',
      'scroll',
      'touchstart',
      'touchmove',
      'touchend',
      'focus',
      'input',
      'change'
    ];

    const updateActivity = () => {
      this.lastActivityTime = Date.now();
      if (!this.isCurrentlyOnline) {
        this.setOnlineStatus(true);
      }
    };

    // 各イベントにリスナーを追加
    activityEvents.forEach(eventType => {
      document.addEventListener(eventType, updateActivity, { passive: true });
    });

    // ページの可視性変更を監視
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // ページが表示されたら即座にオンライン状態に
        this.lastActivityTime = Date.now();
        this.setOnlineStatus(true);
      }
    });

    console.log('Activity listeners set up for:', activityEvents.join(', '));
  }

  private startActivityTimeout() {
    // 既存のタイムアウトをクリア
    if (this.activityTimeoutInterval) {
      clearInterval(this.activityTimeoutInterval);
    }

    // 1秒ごとにアクティビティをチェック
    this.activityTimeoutInterval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      
      if (timeSinceLastActivity > this.ACTIVITY_TIMEOUT) {
        // アクティビティがない場合はオフライン状態に
        if (this.isCurrentlyOnline) {
          console.log(`No activity for ${this.ACTIVITY_TIMEOUT}ms, setting offline`);
          this.setOnlineStatus(false);
        }
      }
    }, 1000);
  }

  private async setOnlineStatus(isOnline: boolean, sync: boolean = false) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return;
      }

      // トークンの有効性をチェック
      if (!this.isTokenValid(token)) {
        console.log('Invalid or expired token, stopping online status updates');
        this.stopHeartbeat();
        this.cleanup();
        return;
      }

      const requestBody = JSON.stringify({ isOnline });
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      if (sync) {
        // 同期的に送信（ページ離脱時用）
        // sendBeaconでは認証ヘッダーが送れないので、fetch with keepaliveを使用
        try {
          await fetch('/api/user-search/status', {
            method: 'PUT',
            headers,
            body: requestBody,
            keepalive: true // ページ離脱時でもリクエストを完了
          });
        } catch (error) {
          // keepaliveが失敗した場合のフォールバック
          console.warn('Keepalive request failed, using sendBeacon as fallback');
          // トークンなしでとりあえず送信（サーバー側で適切に処理する必要あり）
          const blob = new Blob([requestBody], { type: 'application/json' });
          navigator.sendBeacon('/api/user-search/status', blob);
        }
      } else {
        // 非同期送信
        const response = await fetch('/api/user-search/status', {
          method: 'PUT',
          headers,
          body: requestBody
        });

        if (!response.ok) {
          // 401エラーの場合は認証エラーとして処理
          if (response.status === 401) {
            console.log('Authentication failed (401), stopping online status updates');
            this.stopHeartbeat();
            this.cleanup();
            // トークンを削除してユーザーをログアウト状態にする
            localStorage.removeItem('authToken');
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      this.isCurrentlyOnline = isOnline;
      console.log(`Online status updated: ${isOnline}`);
    } catch (error) {
      console.error('Failed to update online status:', error);
      // 401エラーの場合はheartbeatを停止
      if (error.message && error.message.includes('401')) {
        console.log('Stopping heartbeat due to authentication error');
        this.stopHeartbeat();
        this.cleanup();
      }
    }
  }

  // JWTトークンの有効性をチェックする関数
  private isTokenValid(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const payload = JSON.parse(atob(parts[1]));
      
      // トークンの有効期限をチェック
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return false;
      }

      // 2FA完了済みのトークンかチェック
      if (payload.twoFactorPending === true) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  public async setUserOnline() {
    await this.setOnlineStatus(true);
  }

  public async setUserOffline() {
    await this.setOnlineStatus(false);
  }

  public cleanup() {
    // 明示的なクリーンアップが必要な場合
    this.stopHeartbeat();
    if (this.activityTimeoutInterval) {
      clearInterval(this.activityTimeoutInterval);
      this.activityTimeoutInterval = null;
    }
    this.setOnlineStatus(false);
  }

  public async logout() {
    // ログアウト時にオフライン状態に設定してトークンを削除
    this.stopHeartbeat();
    if (this.activityTimeoutInterval) {
      clearInterval(this.activityTimeoutInterval);
      this.activityTimeoutInterval = null;
    }
    await this.setOnlineStatus(false);
    localStorage.removeItem('authToken');
    this.isInitialized = false;
    console.log('User logged out and set offline');
  }

  private startHeartbeat() {
    // 既存のheartbeatを停止
    this.stopHeartbeat();
    
    // 定期的にオンライン状態を送信
    this.heartbeatInterval = setInterval(() => {
      const token = localStorage.getItem('authToken');
      if (token && !document.hidden && this.isCurrentlyOnline) {
        // トークンの有効性をチェック
        if (this.isTokenValid(token)) {
          this.setOnlineStatus(true);
        } else {
          console.log('Token invalid during heartbeat, stopping heartbeat');
          this.stopHeartbeat();
          this.cleanup();
        }
      }
    }, this.HEARTBEAT_INTERVAL);

    console.log('Heartbeat started');
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('Heartbeat stopped');
    }
  }
}
