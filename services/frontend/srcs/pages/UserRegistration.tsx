import React from 'react';

interface UserRegistrationProps {
  navigate: (page: string) => void;
}

const UserRegistration: React.FC<UserRegistrationProps> = ({ navigate }) => {
  // Tailwind CSSクラスを使った色の定義
  const inputIconColor = "text-slate-500";
  const inputBorderColor = "border-slate-400";
  const checkmarkIconColor = "text-slate-600";
  const inputTextColor = "text-slate-700";

  return (
    <div className="flex items-center justify-center min-h-screen bg-white p-4">
      <div className="flex flex-col sm:flex-row items-center">
        {/* 入力フォーム群のコンテナ */}
        <div className="w-full max-w-sm sm:max-w-md mb-12 sm:mb-0 sm:mr-16 md:mr-20 lg:mr-24">
          {/* ユーザー名入力フィールド */}
          {/* 上下のパディングを py-4 に変更、左右のパディングは px-5 を維持 */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 mb-5 bg-white`}> {/* 変更点 */}
            <img
              src="/images/icons/signup.svg"
              alt=""
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="text"
              aria-label="Username"
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>

          {/* メールアドレス入力フィールド */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 mb-5 bg-white`}> {/* 変更点 */}
            <img
              src="/images/icons/mail.svg"
              alt=""
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="email"
              aria-label="Email"
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>

          {/* パスワード入力フィールド */}
          <div className={`flex items-center ${inputBorderColor} border rounded-lg py-4 px-5 bg-white`}> {/* 変更点 */}
            <img
              src="/images/icons/key.svg"
              alt=""
              className={`w-7 h-7 mr-5 ${inputIconColor}`}
            />
            <input
              type="password"
              aria-label="Password"
              className={`w-full focus:outline-none bg-transparent ${inputTextColor} text-lg`}
            />
          </div>
        </div>

        {/* 登録ボタン (チェックマークアイコン) */}
        <button
          onClick={() => navigate('TwoFactorAuth')}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 rounded-full"
          aria-label="Register"
        >
          <img
            src="/images/icons/check.svg"
            alt="Submit registration"
            className={`w-40 h-40 sm:w-48 sm:h-48 ${checkmarkIconColor}`}
          />
        </button>
      </div>
    </div>
  );
};

export default UserRegistration;