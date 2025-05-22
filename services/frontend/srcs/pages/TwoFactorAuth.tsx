import React, { useState, useRef, useEffect } from 'react';

interface TwoFactorAuthProps {
  navigate: (page: string) => void;
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ navigate }) => {
  // 6つの入力フィールド用の状態
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  // エラー時の振動アニメーション用の状態
  const [isShaking, setIsShaking] = useState(false);

  // 各入力フィールドへの参照
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 初期化時に参照配列を設定
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  // 入力処理関数
  const handleInputChange = (index: number, value: string) => {
    // 数字のみ受け付ける
    if (!/^\d*$/.test(value)) return;

    // 状態を更新
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // 入力があれば次のフィールドにフォーカス
    if (value !== '' && index < 5) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
      }
    }

    // すべてのフィールドが埋まったかどうかを確認し、検証を実行
    const allFilled = newCode.every(digit => digit !== '');

    if (allFilled) {
      // 最新の入力値（newCode）を直接検証に使用
      verifyCode(newCode);
    }
  };

  // 検証関数 - 現在のcodeまたは渡された配列を使用
  const verifyCode = (codeToVerify?: string[]) => {
    // 引数が渡された場合はそれを使用、そうでなければcodeステートを使用
    const fullCode = (codeToVerify || code).join('');
    console.log('Full Code:', fullCode);

    if (fullCode === '000000') {
      // 正しいコードの場合
      navigate('MyPage');
    } else {
      // 間違ったコードの場合、振動アニメーションを実行
      setIsShaking(true);

      // 振動アニメーション後、入力をリセット
      setTimeout(() => {
        setIsShaking(false);
        setCode(Array(6).fill(''));
        // 最初の入力フィールドにフォーカスを戻す
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 500);
    }
  };

  // キー処理関数（バックスペースで前のフィールドに戻る）
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && code[index] === '' && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  // メール再送信処理
  const handleResendEmail = () => {
    console.log('[MOCK] The email has been resent');
    // モック通知などを表示する場合はここに追加
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
      <div className="w-full max-w-3xl flex flex-col items-center">
        {/* Resend Code button with SVG icon - placed at top */}
        <div className="flex justify-center mb-24 mt-1">
          <button
            onClick={handleResendEmail}
            className="focus:outline-none hover:opacity-80 transition-opacity"
            aria-label="Resend Code"
          >
            <img
              src="/images/icons/resend_mail.svg"
              alt="Resend verification code"
              className="w-40 h-40"
            />
          </button>
        </div>

        {/* 6桁の入力フィールド - centered and enlarged */}
        <div
          className={`flex justify-center items-center space-x-6 ${isShaking ? 'animate-shake' : ''}`}
          style={{
            animationDuration: isShaking ? '0.5s' : '0',
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="relative" style={{ width: '90px', height: '90px' }}>
              <img
                src="/images/icons/authentication_code_input_field.svg"
                alt="Input field"
                className="absolute inset-0 w-full h-full"
              />
              <input
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={code[index]}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="absolute inset-0 w-full h-full text-center text-4xl font-bold text-black bg-transparent border-none focus:outline-none"
                style={{ zIndex: 10 }}
                autoFocus={index === 0}
              />
            </div>
          ))}
        </div>
      </div>

      {/* スタイルにフォーカス時のスタイルも追加 */}
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
        input:focus + img {
          border: 2px solid #6D6F8C;
          border-radius: 30px;
        }
        `}
      </style>
    </div>
  );
};

export default TwoFactorAuth;
