import React, { useState } from 'react';
import { apiClient } from '../utils/apiClient';

interface EmailVerificationProps {
  navigate: (page: string) => void;
}

interface FormData {
  email: string;
  password: string;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ navigate }) => {
  // Tailwind CSSクラスを使った色の定義 (UserRegistrationから流用)
  const inputIconColor = "text-slate-500"; // アイコンの色
  const inputBorderColor = "border-slate-400"; // 入力フィールドの枠線の色
  const checkmarkIconColor = "text-slate-600"; // チェックマークの色
  const inputTextColor = "text-slate-700"; // 入力テキストの色
  // placeholderColor は不要になったためコメントアウトまたは削除しても良い
  // const placeholderColor = "placeholder-slate-400"; // プレースホルダーのテキスト色

  // フォームデータの状態管理
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 入力値変更ハンドラー
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ログイン認証処理
  const handleVerify = async () => {
    if (!formData.email || !formData.password) {
      setMessage('Please enter both email and password');
      return;
    }

    setLoading(true);
    setMessage('');    try {
      const result = await apiClient.login({
        email: formData.email,
        password: formData.password,
      });

      if (result.success) {
        // 認証成功時のみTwoFactorAuthページに遷移
        navigate('TwoFactorAuth');
      } else {
        setMessage(result.message || 'Authentication failed');
      }
    } catch (error) {
      setMessage('Network error occurred');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-white p-4">
      <div className="flex flex-col sm:flex-row items-center">
        {/* 入力フォーム群のコンテナ */}
        {/* UserRegistrationの幅指定とマージンを適用 */}
        <div className="w-full max-w-sm sm:max-w-md mb-12 sm:mb-0 sm:mr-16 md:mr-20 lg:mr-24">
          {/* メッセージ表示 */}
          {message && (
            <div className="mb-4 p-3 rounded-lg text-center bg-red-100 text-red-700">
              {message}
            </div>
          )}

          {/* メールアドレス入力フィールド */}
          {/* UserRegistrationのスタイル (パディング、アイコンサイズ、マージン、フォントサイズ) を適用 */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 mb-5 bg-white`}>
            <img
              src="/images/icons/mail.svg" // public/images/icons/mail.svg などのパスを想定
              alt="Email icon"
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="email"
              // placeholder="Email" // プレースホルダーを削除
              aria-label="Email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>

          {/* パスワード入力フィールド */}
          {/* UserRegistrationのスタイルを適用。最後の入力フィールドなので下マージンはなし */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 bg-white`}>
            <img
              src="/images/icons/key.svg" // public/images/icons/key.svg などのパスを想定
              alt="Password icon"
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="password"
              // placeholder="Password" // プレースホルダーを削除
              aria-label="Password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>
        </div>

        {/* 送信ボタン (チェックマークアイコン) */}
        {/* UserRegistrationのボタンスタイルとアイコンサイズを適用 */}
        <button
          onClick={handleVerify}
          disabled={loading}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 rounded-full disabled:opacity-50"
          aria-label="Verify"
        >
          <img
            src="/images/icons/check.svg" // public/images/icons/check.svg などのパスを想定
            alt="Verify submission"
            // UserRegistrationと同じアイコンサイズを適用
            className={`w-40 h-40 sm:w-48 sm:h-48 ${checkmarkIconColor}`}
          />
        </button>
      </div>
    </div>
  );
};

export default EmailVerification;