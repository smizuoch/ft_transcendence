import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/auth';

// ユーザー登録
export const register = async (username: string, email: string, password: string) => {
  const response = await axios.post(`${API_URL}/register`, {
    username,
    email,
    password,
  });
  return response.data;
};

// ログイン
export const login = async (email: string, password: string) => {
  const response = await axios.post(`${API_URL}/login`, {
    email,
    password,
  });
  
  // トークンをローカルストレージに保存
  if (response.data.access_token) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  
  return response.data;
};

// ログアウト
export const logout = () => {
  localStorage.removeItem('user');
};

// 現在のユーザー情報を取得
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};

// 認証ヘッダーを取得（他のAPI呼び出しで使用）
export const getAuthHeader = () => {
  const user = getCurrentUser();
  
  if (user && user.access_token) {
    return { Authorization: `Bearer ${user.access_token}` };
  } else {
    return {};
  }
};

// 2FA検証コード送信
export const verify2FACode = async (code: string) => {
  const response = await axios.post(`${API_URL}/verify-2fa`, { code }, {
    headers: getAuthHeader()
  });
  return response.data;
};
