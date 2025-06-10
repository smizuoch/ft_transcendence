// API通信を隠蔽するクライアント
// Mixed Contentエラーを回避するため、環境に応じてエンドポイントを切り替える

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

class ApiClient {
  private baseURL: string;

  constructor() {
    // 本番環境（HTTPSページから）の場合は相対パス、開発環境では直接アクセス
    this.baseURL = this.getBaseURL();
  }

  private getBaseURL(): string {
    // HTTPSページから読み込まれている場合は相対パスを使用（プロキシ経由）
    if (window.location.protocol === 'https:') {
      return '/api';
    }
    
    // 開発環境でも相対パス（プロキシ経由）を使用してMixed Content回避
    return '/api';
  }

  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || `HTTP Error: ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API Request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // 認証関連API
  async register(userData: { username: string; email: string; password: string }) {
    return this.makeRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials: { email: string; password: string }) {
    return this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async verifyEmail(token: string) {
    return this.makeRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async setupTwoFactor() {
    return this.makeRequest('/auth/2fa/setup', {
      method: 'POST',
    });
  }

  async verifyTwoFactor(token: string) {
    return this.makeRequest('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // Google認証関連API
  getGoogleAuthUrl(): string {
    return `${this.baseURL}/auth/google`;
  }

  // 認証コールバック処理（トークンをURLパラメータから取得）
  handleAuthCallback(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // トークンをローカルストレージに保存
      localStorage.setItem('authToken', token);
      
      // URLからトークンパラメータを削除
      window.history.replaceState({}, document.title, window.location.pathname);
      
      return token;
    }
    
    return null;
  }

  // 保存されたトークンを取得
  getStoredToken(): string | null {
    return localStorage.getItem('authToken');
  }

  // ログアウト
  logout(): void {
    localStorage.removeItem('authToken');
  }

  // ユーザー関連API
  async getUserProfile(userId: string) {
    return this.makeRequest(`/user/${userId}`, {
      method: 'GET',
    });
  }

  async updateUserProfile(userId: string, userData: any) {
    return this.makeRequest(`/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }
}

// シングルトンインスタンスをエクスポート
export const apiClient = new ApiClient();

// 型定義もエクスポート
export type { ApiResponse };
