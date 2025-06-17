export const isUserAuthenticated = (): boolean => {
  const token = localStorage.getItem('authToken');
  console.log('🔍 Auth check - Token exists:', !!token);

  if (!token) return false;

  try {
    // JWTの形式をチェック（Base64デコードして基本的な検証）
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('❌ Invalid JWT format');
      return false;
    }

    // ペイロードをデコード
    const payload = JSON.parse(atob(parts[1]));
    console.log('🔍 JWT Payload:', payload);

    // トークンの有効期限をチェック
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.log('❌ Token expired');
      return false;
    }

    // 2FA完了済みのトークンかチェック（twoFactorPendingがtrueでない）
    const isAuthenticated = payload.twoFactorPending !== true;
    console.log('🔍 twoFactorPending:', payload.twoFactorPending);
    console.log('🔍 Is authenticated:', isAuthenticated);

    return isAuthenticated;
  } catch (error) {
    console.log('❌ JWT decode error:', error);
    return false;
  }
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};