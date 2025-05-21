import React, { useState, useRef, useEffect } from 'react';

const Home: React.FC = () => {
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

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleGoogleSignIn = () => console.log("Google Sign In");
  const handleSignIn = () => console.log("Sign In");
  const handleSignUp = () => console.log("Sign Up");

  const iconColor = '#6D6F8C';

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
            onClick={handleGoogleSignIn}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 hover:bg-slate-100 rounded transition-colors p-2"
            aria-label="Sign in with Google"
          >
            <img src="/images/icons/google.svg" alt="Google Sign In" className="w-14 h-14" />
          </button>

          <button
            onClick={handleSignUp}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 hover:bg-slate-100 rounded transition-colors p-2"
            aria-label="Sign Up"
          >
            <img src="/images/icons/signup.svg" alt="Sign Up" className="w-14 h-14" />
          </button>

          <button
            onClick={handleSignIn}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 hover:bg-slate-100 rounded transition-colors p-2"
            aria-label="Sign In"
          >
            <img src="/images/icons/signin.svg" alt="Sign In" className="w-14 h-14" />
          </button>

          <button
            onClick={toggleMute}
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 hover:bg-slate-100 rounded transition-colors p-2"
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
    </div>
  );
};

export default Home;