import React, { useState, useRef, useEffect } from 'react';
import { apiClient } from '../utils/authApiClient';
import { isUserAuthenticated } from '../utils/authUtils';

interface HomeProps {
  navigate: (page: string) => void;
}

const Home: React.FC<HomeProps> = ({ navigate }) => {
  const [isMuted, setIsMuted] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // JWTが有効ならMyPageにリダイレクト
    if (isUserAuthenticated()) {
      navigate('MyPage');
      return;
    }

    // URLパラメータからエラーメッセージを取得
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const message = urlParams.get('message');

    if (error) {
      switch (error) {
        case 'invalid_username':
          setErrorMessage('Google認証に失敗しました。ユーザー名は英数字のみ使用可能です。');
          break;
        case 'username_too_long':
          setErrorMessage('Google認証に失敗しました。ユーザー名は16文字以下である必要があります。');
          break;
        case 'username_taken':
          setErrorMessage('Google認証に失敗しました。このユーザー名は既に使用されています。');
          break;
        case 'auth_failed':
          setErrorMessage('Google認証に失敗しました。再度お試しください。');
          break;
        default:
          setErrorMessage(message || 'Google認証に失敗しました。');
      }

      // URLからエラーパラメータを削除
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

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
      {/* エラーメッセージ表示 */}
      {errorMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 max-w-md z-50">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-lg">
            <div className="flex">
              <div className="py-1">
                <svg className="fill-current h-4 w-4 text-red-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm">{errorMessage}</p>
              </div>
              <div className="pl-2">
                <button
                  onClick={() => setErrorMessage('')}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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