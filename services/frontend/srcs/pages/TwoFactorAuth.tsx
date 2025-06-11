// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { TwoFactorApi } from '../utils/twoFactorApi';

interface TwoFactorAuthProps {
  navigate: (page: string) => void;
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ navigate }) => {

  const iconColor = '#6D6F8C';

  // 6つの入力フィールド用の状態
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  // エラー時の振動アニメーション用の状態
  const [isShaking, setIsShaking] = useState(false);  // ローディング状態
  const [isLoading, setIsLoading] = useState(false);
  // エラーメッセージ
  const [errorMessage, setErrorMessage] = useState<string>('');
  // 成功メッセージ
  const [successMessage, setSuccessMessage] = useState<string>('');
  // コード送信済みフラグ
  const [isCodeSent, setIsCodeSent] = useState(false);

  // 各入力フィールドへの参照
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // JWTトークンを取得（localStorageから）
  const getJwtToken = (): string | null => {
    return localStorage.getItem('access_token');
  };

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
  const verifyCode = async (codeToVerify?: string[]) => {
    const fullCode = (codeToVerify || code).join('');
    console.log('Full Code:', fullCode);

    if (fullCode.length !== 6) {
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const token = getJwtToken();
      if (!token) {
        setErrorMessage('認証が必要です。再ログインしてください。');
        return;
      }

      const result = await TwoFactorApi.verifyTwoFactorCode(token, fullCode);
      
      if (result.success) {
        setSuccessMessage('認証が完了しました！');
        setTimeout(() => {
          navigate('MyPage');
        }, 1000);
      } else {
        setErrorMessage(result.message || '認証に失敗しました');
        handleInvalidCode();
      }
    } catch (error) {
      console.error('2FA検証エラー:', error);
      setErrorMessage('認証に失敗しました。再試行してください。');
      handleInvalidCode();
    } finally {
      setIsLoading(false);
    }
  };

  // 無効なコードの処理
  const handleInvalidCode = () => {
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setCode(Array(6).fill(''));
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }, 500);
  };

  // キー処理関数（バックスペースで前のフィールドに戻る）
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && code[index] === '' && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
      }
    }
  };  // 初回コード送信処理
  const handleSendCode = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = getJwtToken();
      if (!token) {
        setErrorMessage('認証が必要です。再ログインしてください。');
        return;
      }

      const result = await TwoFactorApi.sendTwoFactorCode(token);
      
      if (result.success) {
        setSuccessMessage('認証コードを送信しました');
        setIsCodeSent(true);
        // 最初の入力フィールドにフォーカス
        setTimeout(() => {
          if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
          }
        }, 100);
      } else {
        setErrorMessage(result.message || 'コードの送信に失敗しました');
      }
    } catch (error) {
      console.error('2FAコード送信エラー:', error);
      setErrorMessage('コードの送信に失敗しました。再試行してください。');
    } finally {
      setIsLoading(false);
    }
  };

  // メール再送信処理
  const handleResendEmail = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const token = getJwtToken();
      if (!token) {
        setErrorMessage('認証が必要です。再ログインしてください。');
        return;
      }

      const result = await TwoFactorApi.sendTwoFactorCode(token);
      
      if (result.success) {
        setSuccessMessage('認証コードを再送信しました');
        // コード入力欄をリセット
        setCode(Array(6).fill(''));
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      } else {
        setErrorMessage(result.message || 'コードの送信に失敗しました');
      }
    } catch (error) {
      console.error('2FAコード再送信エラー:', error);
      setErrorMessage('コードの送信に失敗しました。再試行してください。');
    } finally {
      setIsLoading(false);
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
          {/* 成功メッセージ表示 */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {successMessage}
          </div>
        )}

        {/* コード未送信時：初回送信ボタン */}
        {!isCodeSent && (
          <div className="flex flex-col items-center mb-24">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">2段階認証</h2>
            <p className="text-gray-600 mb-8 text-center">
              認証コードをメールに送信します。<br/>
              受信したコードを入力してください。
            </p>
            <button
              onClick={handleSendCode}
              disabled={isLoading}
              className={`px-8 py-3 bg-blue-500 text-white rounded-lg font-semibold transition-all duration-200
                ${isLoading 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:bg-blue-600 hover:scale-105 active:scale-95'
                }`}
            >
              {isLoading ? '送信中...' : '認証コードを送信'}
            </button>
          </div>
        )}

        {/* コード送信後：入力フィールドと再送信ボタン */}
        {isCodeSent && (
          <>
            {/* Resend Code button with SVG icon - placed at top */}
            <div className="flex justify-center mb-24 mt-1">
              <button
                onClick={handleResendEmail}
                disabled={isLoading}
                className={`focus:outline-none hover:opacity-80 transition-opacity ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    ref={(el) => {
                      if (el) inputRefs.current[index] = el;
                      return undefined;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={code[index]}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="absolute inset-0 w-full h-full text-center text-4xl font-bold bg-transparent border-none focus:outline-none"
                    style={{ zIndex: 10, color: iconColor }}
                    autoFocus={index === 0}
                  />
                </div>
              ))}
            </div>
          </>
        )}
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
