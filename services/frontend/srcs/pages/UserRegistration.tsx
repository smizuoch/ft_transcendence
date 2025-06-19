import React, { useState } from 'react';
import { apiClient } from '../utils/authApiClient';

interface UserRegistrationProps {
  navigate: (page: string) => void;
}

interface FormData {
  username: string;
  email: string;
  password: string;
}

const UserRegistration: React.FC<UserRegistrationProps> = ({ navigate }) => {
  // フォームデータの状態管理
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    password: ''
  });  const [loading, setLoading] = useState(false);
  // エラー時の振動アニメーション用の状態
  const [isShaking, setIsShaking] = useState(false);

  // Tailwind CSSクラスを使った色の定義
  const inputIconColor = "text-slate-500";
  const inputBorderColor = "border-slate-400";
  const checkmarkIconColor = "text-slate-600";
  const inputTextColor = "text-slate-700";

  // 入力値変更ハンドラー
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  // フォーム送信ハンドラー
  const handleSubmit = async () => {
    if (!formData.username || !formData.email || !formData.password) {
      // 振動アニメーションを実行
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
      }, 500);
      return;
    }

    setLoading(true);

    try {
      const result = await apiClient.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });      if (result.success) {
        // 登録成功後、自動ログインを試行
        try {
          const loginResult = await apiClient.login({
            email: formData.email,
            password: formData.password,
          });
          
          if (loginResult.success && loginResult.data && loginResult.data.access_token) {
            // トークンをローカルストレージに保存
            localStorage.setItem('authToken', loginResult.data.access_token);
            setFormData({ username: '', email: '', password: '' });
            // 2要素認証画面に遷移
            setTimeout(() => navigate('TwoFactorAuth'), 1000);
          } else {
            // ログインに失敗した場合、メール確認画面に遷移
            setFormData({ username: '', email: '', password: '' });
            setTimeout(() => navigate('EmailVerification'), 1000);
          }
        } catch (loginError) {
          // ログインエラーの場合、メール確認画面に遷移
          setFormData({ username: '', email: '', password: '' });
          setTimeout(() => navigate('EmailVerification'), 1000);
        }
      } else {
        // 振動アニメーションを実行
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setFormData({ username: '', email: '', password: '' });
        }, 500);
      }
    } catch (error) {
      // 振動アニメーションを実行
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        setFormData({ username: '', email: '', password: '' });
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white p-4">
      <div className="flex flex-col sm:flex-row items-center">        {/* 入力フォーム群のコンテナ */}
        <div className={`w-full max-w-sm sm:max-w-md mb-12 sm:mb-0 sm:mr-16 md:mr-20 lg:mr-24 ${isShaking ? 'animate-shake' : ''}`}
          style={{
            animationDuration: isShaking ? '0.5s' : '0',
          }}
        >

          {/* ユーザー名入力フィールド */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 mb-5 bg-white`}>
            <img
              src="/images/icons/signup.svg"
              alt=""
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="text"
              aria-label="Username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>

          {/* メールアドレス入力フィールド */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 mb-5 bg-white`}>
            <img
              src="/images/icons/mail.svg"
              alt=""
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="email"
              aria-label="Email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>

          {/* パスワード入力フィールド */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 bg-white`}>
            <img
              src="/images/icons/key.svg"
              alt=""
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="password"
              aria-label="Password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>
        </div>

        {/* 登録ボタン (チェックマークアイコン) */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 rounded-full disabled:opacity-50"
          aria-label="Register"
        >
          <img
            src="/images/icons/check.svg"
            alt="Submit registration"
            className={`w-40 h-40 sm:w-48 sm:h-48 ${checkmarkIconColor} ${loading ? 'animate-pulse' : ''}`}
          />        </button>
      </div>

      {/* 振動アニメーション用のスタイル */}
      <style>
        {`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
          20%, 40%, 60%, 80% { transform: translateX(10px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        `}
      </style>
    </div>
  );
};

export default UserRegistration;