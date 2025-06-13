// Online status management utility
export class OnlineStatusManager {
  private static instance: OnlineStatusManager;
  private isInitialized = false;
  private heartbeatInterval: number | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒間隔

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

    // ページ読み込み時にオンライン状態を設定
    this.setOnlineStatus(true);

    // 定期的なheartbeatを開始
    this.startHeartbeat();

    // ページ離脱時にオフライン状態を設定
    window.addEventListener('beforeunload', () => {
      this.setOnlineStatus(false, true); // 同期的に送信
    });

    // ページの可視性変更時にオンライン状態を管理
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // ページが非表示になった時はheartbeatを停止してオフライン
        this.stopHeartbeat();
        this.setOnlineStatus(false);
      } else {
        // ページが表示された時はオンラインに戻してheartbeatを再開
        this.setOnlineStatus(true);
        this.startHeartbeat();
      }
    });

    // フォーカス/ブラー時のオンライン状態管理（より細かい制御）
    let isPageActive = true;
    
    window.addEventListener('focus', () => {
      if (!isPageActive) {
        isPageActive = true;
        this.setOnlineStatus(true);
      }
    });

    window.addEventListener('blur', () => {
      // 少し遅延を入れて、すぐに戻ってくる場合は無視
      setTimeout(() => {
        if (document.hidden) {
          isPageActive = false;
          this.setOnlineStatus(false);
        }
      }, 5000); // 5秒後にチェック
    });

    this.isInitialized = true;
    console.log('Online status management initialized');
  }

  private async setOnlineStatus(isOnline: boolean, sync: boolean = false) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
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
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      console.log(`Online status updated: ${isOnline}`);
    } catch (error) {
      console.error('Failed to update online status:', error);
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
    this.setOnlineStatus(false);
  }

  public async logout() {
    // ログアウト時にオフライン状態に設定してトークンを削除
    this.stopHeartbeat();
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
      if (token && !document.hidden) {
        this.setOnlineStatus(true);
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
