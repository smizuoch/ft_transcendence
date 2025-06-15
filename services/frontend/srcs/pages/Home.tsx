import React, { useState, useRef, useEffect } from 'react';
import { apiClient } from '../utils/authApiClient';
// import { Link } from 'react-router-dom'; // 削除

interface HomeProps {
  navigate: (page: string) => void;
}

const Home: React.FC<HomeProps> = ({ navigate }) => {
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // コンポーネントマウント時にオーディオ要素を作成
    audioRef.current = new Audio('/audio/siokaze.mp3');

    if (audioRef.current) {
      audioRef.current.loop = true; // ループ再生を設定

      // ミュート状態に応じて再生/ミュート
      if (!isMuted) {
        audioRef.current.play().catch(error => {
          console.error('Audio playback failed:', error);
        });
      }
    }

    // クリーンアップ関数
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  // ミュート状態が変わったときの処理
  useEffect(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => {
          console.error('Audio playback failed:', error);
        });
      }
    }
  }, [isMuted]);

  const handleGoogleAuth = () => {
    // Google認証URLにリダイレクト
    window.location.href = apiClient.getGoogleAuthUrl();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const iconColor = '#6D6F8C';

  // 環境変数でskipボタンの表示を制御
  const showSkipButton = import.meta.env.VITE_SHOW_SKIP_BUTTON === 'true';

  // デバッグ用: 環境変数の値をコンソールに出力
  console.log('VITE_SHOW_SKIP_BUTTON:', import.meta.env.VITE_SHOW_SKIP_BUTTON);
  console.log('showSkipButton:', showSkipButton);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-white text-slate-700 font-sans overflow-hidden">
      {/* Central PONG text */}
      <h1 className="text-9xl font-bold" style={{ color: iconColor }}>
        PONG
      </h1>

      {/* Icons container positioned at top-right corner with further increased spacing */}
      <div className="absolute top-16 right-16 w-[180px] h-[180px]">
        <div className="relative w-full h-full">
          {/* Decorative X lines */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="absolute w-full h-[1px] transform rotate-45"
              style={{ backgroundColor: iconColor }}
            ></div>
            <div
              className="absolute w-full h-[1px] transform -rotate-45"
              style={{ backgroundColor: iconColor }}
            ></div>
          </div>

          {/* Icons positioned in plus shape - doubled size */}
          <button
            onClick={handleGoogleAuth}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 hover:opacity-80 transition-opacity p-2"
            aria-label="Sign in with Google"
          >
            <img src="/images/icons/google.svg" alt="Google Sign In" className="w-14 h-14" />
          </button>

          <button
            onClick={() => navigate('UserRegistration')}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 hover:opacity-80 transition-opacity p-2"
            aria-label="Sign Up"
          >
            <img src="/images/icons/signup.svg" alt="Sign Up" className="w-14 h-14" />
          </button>

          <button
            onClick={() => navigate('EmailVerification')}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 hover:opacity-80 transition-opacity p-2"
            aria-label="Sign In"
          >
            <img src="/images/icons/signin.svg" alt="Sign In" className="w-14 h-14" />
          </button>

          <button
            onClick={toggleMute}
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 hover:opacity-80 transition-opacity p-2"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            <img
              src={isMuted ? "/images/icons/mute.svg" : "/images/icons/unmute.svg"}
              alt={isMuted ? "Unmute" : "Mute"}
              className="w-14 h-14"
            />
          </button>
        </div>
      </div>

      {/* Skip button - 環境変数が設定されている場合のみ表示 */}
      {showSkipButton && (
        <button
          onClick={() => navigate('GameSelect')}
          className="absolute bottom-4 right-4 bg-slate-100 hover:opacity-80 transition-opacity text-slate-700 px-4 py-2 rounded border"
          aria-label="Skip to GameSelect"
        >
          skip
        </button>
      )}
    </div>
  );
};

export default Home;
