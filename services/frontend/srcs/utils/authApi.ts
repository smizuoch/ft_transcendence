// API client for secure communication with backend services
// Uses Nginx proxy to avoid Mixed Content errors

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface VerificationData {
  email: string;
  code: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor() {
    // Nginxプロキシを活用してMixed Content回避
    // `/api/auth/` → `http://auth:3000/auth/` にプロキシされる
    this.baseUrl = '/api';
  }

  private async request<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: data.message || `HTTP Error: ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  // ユーザー登録
  async register(userData: RegisterData): Promise<ApiResponse> {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // ユーザーログイン
  async login(loginData: LoginData): Promise<ApiResponse> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData),
    });
  }

  // メール検証
  async verifyEmail(verificationData: VerificationData): Promise<ApiResponse> {
    return this.request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(verificationData),
    });
  }

  // 2要素認証
  async verifyTwoFactor(verificationData: VerificationData): Promise<ApiResponse> {
    return this.request('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify(verificationData),
    });
  }

  // ユーザー情報取得
  async getUserInfo(token: string): Promise<ApiResponse> {
    return this.request('/user/profile', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }
}

// シングルトンインスタンスをエクスポート
export const apiClient = new ApiClient();

// デフォルトエクスポートも提供
export default apiClient;
