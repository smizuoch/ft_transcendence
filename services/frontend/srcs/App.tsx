import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home'; // エイリアスパス @ を使用
import UserRegistration from '@/pages/UserRegistration';
import EmailVerification from '@/pages/EmailVerification';
import TwoFactorAuth from '@/pages/TwoFactorAuth';
import MyPage from '@/pages/MyPage';
import GameSelect from '@/pages/GameSelect';
import GamePong2 from '@/pages/GamePong2';
import GamePong42 from '@/pages/GamePong42';
import GameResult from '@/pages/GameResult';
import UserProfile from '@/pages/UserProfile';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/user-registration" element={<UserRegistration />} />
        <Route path="/email-verification" element={<EmailVerification />} />
        <Route path="/2fa" element={<TwoFactorAuth />} />
        <Route path="/my-page" element={<MyPage />} />
        <Route path="/game-select" element={<GameSelect />} />
        <Route path="/game-pong2" element={<GamePong2 />} />
        <Route path="/game-pong42" element={<GamePong42 />} />
        <Route path="/game-result" element={<GameResult />} />
        <Route path="/user-profile/:userId" element={<UserProfile />} />
        {/* 将来的に他のページへのルートを追加 */}
        {/* <Route path="/index.html" element={<Home />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
