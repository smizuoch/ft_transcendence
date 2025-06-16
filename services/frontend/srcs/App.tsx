import React, { useState, useEffect } from 'react';
import Home from '@/pages/Home';
import { OnlineStatusManager } from "./utils/onlineStatusManager";
import UserRegistration from '@/pages/UserRegistration';
import EmailVerification from '@/pages/EmailVerification';
import TwoFactorAuth from '@/pages/TwoFactorAuth';
import MyPage from '@/pages/MyPage';
import GameSelect from '@/pages/GameSelect';
import GamePong2 from '@/pages/GamePong2';
import GamePong42 from '@/pages/GamePong42';
import GamePong4 from '@/pages/GamePong4';
import GameResult from '@/pages/GameResult';
import UserProfile from '@/pages/UserProfile';
import AuthCallback from '@/pages/AuthCallback';

interface RouteState {
  page: string;
  userId?: string;
  roomNumber?: string;
  ranking?: number; // GameResult用の順位情報
}

const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<RouteState>({ page: 'Home' });
  const [showBackNavigationPopup, setShowBackNavigationPopup] = useState(false);

  /** -------- routing helper -------- */
  const navigate = (page: string, userId?: string, roomNumber?: string, ranking?: number) => {
    setCurrentRoute({ page, userId, roomNumber, ranking });
    window.history.pushState({ page, userId, roomNumber, ranking }, '', '/');
  };

  /** -------- authentication check -------- */
  const isUserAuthenticated = (): boolean => {
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

  /** -------- back-navigation block -------- */
  const handlePopupConfirm = () => {
    setShowBackNavigationPopup(false);

    // ユーザーがログイン状態ならMyPageに、そうでなければHomeに遷移
    const authenticated = isUserAuthenticated();
    console.log('🔍 Back button pressed - User authenticated:', authenticated);

    if (authenticated) {
      console.log('✅ Navigating to MyPage');
      navigate('MyPage');
    } else {
      console.log('✅ Navigating to Home');
      navigate('Home');
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setShowBackNavigationPopup(true);   // show pop-up instead of navigating back
    };

    window.addEventListener('popstate', handlePopState);
    window.history.replaceState({ page: 'Home' }, '', '/');

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /** -------- オンライン状態管理の初期化 -------- */
  useEffect(() => {
    const onlineStatusManager = OnlineStatusManager.getInstance();
    onlineStatusManager.initialize();

    // アプリ終了時のクリーンアップ
    return () => {
      onlineStatusManager.cleanup();
    };
  }, []);

  /** -------- page renderer -------- */
  const renderPage = () => {
    // Google認証コールバック処理
    if (window.location.pathname === '/auth/callback') {
      return <AuthCallback navigate={navigate} />;
    }

    switch (currentRoute.page) {
      case 'Home':
        return <Home navigate={navigate} />;
      case 'UserRegistration':
        return <UserRegistration navigate={navigate} />;
      case 'EmailVerification':
        return <EmailVerification navigate={navigate} />;
      case 'TwoFactorAuth':
        return <TwoFactorAuth navigate={navigate} />;
      case 'MyPage':
        return <MyPage navigate={navigate} />;
      case 'GameSelect':
        return <GameSelect navigate={navigate} />;
      case 'GamePong2':
        return <GamePong2 navigate={navigate} roomNumber={currentRoute?.roomNumber} />;
      case 'GamePong42':
        return <GamePong42 navigate={navigate} />;
      case 'GamePong4':
        return <GamePong4 navigate={navigate} />;
      case 'GameResult':
        return <GameResult navigate={navigate} ranking={currentRoute?.ranking} />;
      case 'UserProfile':
        return <UserProfile navigate={navigate} userId={currentRoute?.userId} />;
      case 'AuthCallback':
        return <AuthCallback navigate={navigate} />;
      default:
        return <Home navigate={navigate} />;
    }
  };

  /** -------- UI -------- */
  return (
    <>
      {renderPage()}

      {/* ---------- back-navigation pop-up ---------- */}
      {showBackNavigationPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="bg-[#E2E2E8] w-full max-w-xl p-10 rounded-2xl shadow-xl flex flex-col items-center">
            {/* “戻る禁止”アイコン */}
            <img
              src="/images/icons/notreturn.svg"
              alt=""
              className="w-24 h-24 mb-8"
            />

            {/* confirm button (check) */}
            <button
              onClick={handlePopupConfirm}
              className="rounded-full p-4 hover:bg-black/10 transition"
              aria-label="OK – go home"
            >
              <img
                src="/images/icons/check.svg"
                alt=""
                className="w-10 h-10"
              />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
