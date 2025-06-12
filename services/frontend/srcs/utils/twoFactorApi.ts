// 2FA API - Nginxプロキシを使用してMixed Content回避
const API_BASE_URL = '/api';

export interface TwoFactorResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class TwoFactorApi {
  /**
   * 2FAコードを送信（JWT認証必須）
   */
  static async sendTwoFactorCode(token: string): Promise<TwoFactorResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'コードの送信に失敗しました');
      }

      return await response.json();
    } catch (error) {
      console.error('2FAコード送信エラー:', error);
      throw error;
    }
  }

  /**
   * 2FAコードを検証（JWT認証必須）
   */
  static async verifyTwoFactorCode(token: string, code: string): Promise<TwoFactorResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'コードの検証に失敗しました');
      }

      return await response.json();
    } catch (error) {
      console.error('2FAコード検証エラー:', error);
      throw error;
    }
  }
}
