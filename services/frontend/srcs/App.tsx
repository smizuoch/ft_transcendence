import React, { useState, useEffect } from 'react';
import Home from '@/pages/Home';
import UserRegistration from '@/pages/UserRegistration';
import EmailVerification from '@/pages/EmailVerification';
import TwoFactorAuth from '@/pages/TwoFactorAuth';
import MyPage from '@/pages/MyPage';
import GameSelect from '@/pages/GameSelect';
import GamePong2 from '@/pages/GamePong2';
import GamePong42 from '@/pages/GamePong42';
import GameResult from '@/pages/GameResult';
import UserProfile from '@/pages/UserProfile';

interface RouteState {
  page: string;
  userId?: string;
}

const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<RouteState>({ page: 'Home' });
  const [showBackNavigationPopup, setShowBackNavigationPopup] = useState(false);

  /** -------- routing helper -------- */
  const navigate = (page: string, userId?: string) => {
    setCurrentRoute({ page, userId });
    window.history.pushState({ page, userId }, '', '/');
  };

  /** -------- back-navigation block -------- */
  const handlePopupConfirm = () => {
    setShowBackNavigationPopup(false);
    navigate('Home');
  };

  useEffect(() => {
    const handlePopState = () => {
      setShowBackNavigationPopup(true);   // show pop-up instead of navigating back
    };

    window.addEventListener('popstate', handlePopState);
    window.history.replaceState({ page: 'Home' }, '', '/');

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /** -------- page renderer -------- */
  const renderPage = () => {
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
        return <GamePong2 navigate={navigate} />;
      case 'GamePong42':
        return <GamePong42 navigate={navigate} />;
      case 'GameResult':
        return <GameResult navigate={navigate} />;
      case 'UserProfile':
        return <UserProfile navigate={navigate} userId={currentRoute?.userId} />;
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
