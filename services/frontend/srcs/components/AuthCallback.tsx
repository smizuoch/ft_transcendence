import React, { useEffect } from 'react';
import { apiClient } from '../utils/authApiClient';

interface AuthCallbackProps {
  navigate?: (page: string) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ navigate }) => {
  useEffect(() => {
    const token = apiClient.handleAuthCallback();
    
    if (token) {
      // 認証成功 - MyPageに遷移
      console.log('Google認証成功');
      if (navigate) {
        navigate('MyPage');
      } else {
        // navigateが渡されていない場合は、直接ページを変更
        window.location.href = '/';
      }
    } else {
      // 認証失敗 - ホームページに戻る
      console.error('Google認証失敗');
      if (navigate) {
        navigate('Home');
      } else {
        window.location.href = '/';
      }
    }
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg">認証処理中...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
