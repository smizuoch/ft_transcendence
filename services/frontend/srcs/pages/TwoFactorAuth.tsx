import React, { useState, useRef, useEffect } from 'react';
import { TwoFactorApi } from '../utils/twoFactorApi';
import { apiClient } from '../utils/authApiClient';

interface TwoFactorAuthProps {
  navigate: (page: string) => void;
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ navigate }) => {

  const iconColor = '#6D6F8C';

  // 6つの入力フィールド用の状態
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  // エラー時の振動アニメーション用の状態
  const [isShaking, setIsShaking] = useState(false);
  // ローディング状態
  const [loading, setLoading] = useState(false);
  // エラーメッセージ
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 各入力フィールドへの参照
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 初期化時に参照配列を設定とコードの自動送信
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
    // ページ読み込み時に自動的に2FAコードを送信
    handleResendEmail();
  }, []);
  // 入力処理関数
  const handleInputChange = (index: number, value: string) => {
    // 数字のみ受け付ける
    if (!/^\d*$/.test(value)) return;

    // エラーメッセージをクリア
    setErrorMessage('');

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

  // 検証関数 - 実際の2FA APIを使用
  const verifyCode = async (codeToVerify?: string[]) => {
    // 引数が渡された場合はそれを使用、そうでなければcodeステートを使用
    const fullCode = (codeToVerify || code).join('');
    console.log('Verifying Code:', fullCode);

    const token = apiClient.getStoredToken();
    if (!token) {
      setErrorMessage('認証トークンが見つかりません。再度ログインしてください。');
      return;
    }

    setLoading(true);

    try {
      const result = await TwoFactorApi.verifyTwoFactorCode(token, fullCode);
      
      if (result.success) {
        // 正しいコードの場合
        navigate('MyPage');
      } else {
        // 間違ったコードの場合、エラーメッセージを表示し振動アニメーションを実行
        setErrorMessage(result.message || '無効な認証コードです');
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
    } catch (error) {
      console.error('2FA検証エラー:', error);
      setErrorMessage('認証コードの検証中にエラーが発生しました');
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
    } finally {
      setLoading(false);
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
  // メール再送信処理 - 実際の2FA APIを使用
  const handleResendEmail = async () => {
    const token = apiClient.getStoredToken();
    if (!token) {
      setErrorMessage('認証トークンが見つかりません。再度ログインしてください。');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await TwoFactorApi.sendTwoFactorCode(token);
      
      if (result.success) {
        console.log('2FAコードが送信されました');
        setErrorMessage(''); // 成功時はエラーメッセージをクリア
      } else {
        setErrorMessage(result.message || 'コードの送信に失敗しました');
      }
    } catch (error) {
      console.error('2FAコード送信エラー:', error);
      setErrorMessage('コードの送信中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
      <div className="w-full max-w-3xl flex flex-col items-center">
        {/* エラーメッセージ表示 */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {errorMessage}
          </div>
        )}

        {/* Resend Code button with SVG icon - placed at top */}
        <div className="flex justify-center mb-24 mt-1">
          <button
            onClick={handleResendEmail}
            disabled={loading}
            className={`focus:outline-none hover:opacity-80 transition-opacity ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              />              <input
                ref={(el) => {
                  if (el) inputRefs.current[index] = el;
                  return undefined;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={code[index]}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}                className="absolute inset-0 w-full h-full text-center text-4xl font-bold bg-transparent border-none focus:outline-none"
                style={{ zIndex: 10, color: iconColor }}
                autoFocus={index === 0}
                disabled={loading}
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
