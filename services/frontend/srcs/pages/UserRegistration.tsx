import React, { useState } from 'react';

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
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
      setMessage('すべてのフィールドを入力してください');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage('ユーザー登録が完了しました！');
        setFormData({ username: '', email: '', password: '' });
        // 登録成功後、2要素認証画面に遷移
        setTimeout(() => navigate('TwoFactorAuth'), 1000);
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || '登録に失敗しました');
      }
    } catch (error) {
      setMessage('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white p-4">
      <div className="flex flex-col sm:flex-row items-center">
        {/* 入力フォーム群のコンテナ */}
        <div className="w-full max-w-sm sm:max-w-md mb-12 sm:mb-0 sm:mr-16 md:mr-20 lg:mr-24">
          {/* メッセージ表示 */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-center ${
              message.includes('完了') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message}
            </div>
          )}

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
          />
        </button>
      </div>
    </div>
  );
};

export default UserRegistration;