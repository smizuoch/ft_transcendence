import React, { useState, useEffect } from 'react';
// import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'; // 削除
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
  params?: Record<string, string>;
}

const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<RouteState>({ page: 'Home' });

  const navigate = (page: string, params?: Record<string, string>) => {
    setCurrentRoute({ page, params });
    window.history.pushState({ page, params }, '', '/'); // pushStateに現在のページ情報を含める
  };

  useEffect(() => {
    // ブラウザの戻る/進むボタンに対応するための処理
    const handlePopState = (_event: PopStateEvent) => { // 'event' を '_event' に変更
      alert("ブラウザの戻る・進むボタンはサポートされていません。ホームページに戻ります。");
      // 将来的にログイン状態などを考慮してリダイレクト先を変更できるように、
      // ここで 'Home' 以外を指定することも可能です。
      // 例: if (isLoggedIn()) { navigate('MyPage'); } else { navigate('Home'); }
      navigate('Home');
    };

    window.addEventListener('popstate', handlePopState);
    // 初期表示時にURLを '/' に設定し、ページ情報をstateに保存
    window.history.replaceState({ page: 'Home' }, '', '/');


    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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
        return <UserProfile navigate={navigate} userId={currentRoute.params?.userId} />;
      default:
        return <Home navigate={navigate} />; // Not found, redirect to Home
    }
  };

  return (
    <>
      {renderPage()}
    </>
  );
};

export default App;
