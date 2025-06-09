import React, { useState, useRef, useEffect } from 'react';

interface GameSelectProps {
  navigate: (page: string, userId?: string, roomNumber?: string) => void;
}

const GameSelect: React.FC<GameSelectProps> = ({ navigate }) => {
  // 色の定義
  const iconColor = '#6D6F8C';

  // 6つの入力フィールド用の状態
  const [roomNumber, setRoomNumber] = useState<string[]>(Array(6).fill(''));

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
    const newRoomNumber = [...roomNumber];
    newRoomNumber[index] = value;
    setRoomNumber(newRoomNumber);

    // 入力があれば次のフィールドにフォーカス
    if (value !== '' && index < 5) {
      const nextInput = inputRefs.current[index + 1];
      if (nextInput) {
        nextInput.focus();
      }
    }

    // すべてのフィールドが埋まったかどうかを確認し、ゲームに遷移
    const allFilled = newRoomNumber.every(digit => digit !== '');
    if (allFilled) {
      // 6桁全て入力されたらPong2ゲームに遷移
      navigateToPong2(newRoomNumber.join(''));
    }
  };

  // キー処理関数（バックスペースで前のフィールドに戻る）
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && roomNumber[index] === '' && index > 0) {
      const prevInput = inputRefs.current[index - 1];
      if (prevInput) {
        prevInput.focus();
      }
    }
  };
  // Pong2ゲームへの遷移
  const navigateToPong2 = (roomNumberStr?: string) => {
    // 指定された部屋番号か、入力欄の値を使用（空欄は0とみなす）
    const roomCode = roomNumberStr || roomNumber.map(digit => digit || '0').join('');
    console.log(`Navigating to Pong2 with room number: ${roomCode}`);
    navigate('GamePong2', undefined, roomCode);
  };

  // Pong42ゲームへの遷移
  const navigateToPong42 = () => {
    navigate('GamePong42');
  };

  // MyPageへの遷移
  const navigateToMyPage = () => {
    navigate('MyPage');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4 relative">
      {/* X下線 - 画面中央に大きく配置 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-0 w-[200%] h-[1px]"
          style={{
            backgroundColor: iconColor,
            transformOrigin: 'center',
            transform: 'rotate(45deg) translateY(-50%)',
            top: '50%',
            left: '25%',
            width: '50%',
            height: '1px'
          }}
        ></div>
        <div
          className="absolute top-0 left-0 w-[200%] h-[1px]"
          style={{
            backgroundColor: iconColor,
            transformOrigin: 'center',
            transform: 'rotate(-45deg) translateY(-50%)',
            top: '50%',
            left: '25%',
            width: '50%',
            height: '1px'
          }}
        ></div>
      </div>

      {/* MyPage ボタン - 右下に配置 */}
      <button
        onClick={navigateToMyPage}
        className="absolute bottom-16 right-16 hover:opacity-80 transition-opacity"
        aria-label="Back to My Page"
      >
        <img src="/images/icons/mypage.svg" alt="MyPage" className="w-16 h-16" />
      </button>

      <div className="flex flex-col items-center justify-center h-full">
        {/* ゲームボタンコンテナ */}
        <div className="flex justify-center items-center space-x-40 relative">
          {/* Pong2ボタンと、その子要素としての部屋番号入力フィールド */}
          <button
            onClick={() => navigateToPong2()}
            className="relative hover:opacity-80 transition-opacity"
            aria-label="Play Pong 2"
          >
            <img src="/images/icons/pong2.svg" alt="Pong 2" className="w-64 h-64" />
            {/* 部屋番号入力フィールド */}
            <div
              className="absolute w-48" // mt-[-32px] は不要
              style={{
                top: '100%', // ボタンの下端
                left: '50%', // ボタンの水平中央
                transform: 'translateX(-50%) translateY(-32px)', // 上に32pxオフセット
              }}
            >
              <div className="flex justify-between items-center">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="relative" style={{ width: '24px', height: '24px' }}>
                    <img
                      src="/images/icons/room_number_input_field.svg"
                      alt="Input field"
                      className="absolute inset-0 w-full h-full"
                    />                    <input
                      ref={(el) => {
                        if (el) inputRefs.current[index] = el;
                        return undefined;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={roomNumber[index]}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="absolute inset-0 w-full h-full text-center text-xs font-bold bg-transparent border-none focus:outline-none pb-1"
                      style={{ zIndex: 10, color: '#6D6F8C' }}
                      autoFocus={index === 0}
                    />
                  </div>
                ))}
              </div>
            </div>
          </button>

          {/* Pong42ボタン */}
          <button
            onClick={navigateToPong42}
            className="hover:opacity-80 transition-opacity"
            aria-label="Play Pong 42"
          >
            <img src="/images/icons/pong42.svg" alt="Pong 42" className="w-64 h-64" />
          </button>
        </div>
      </div>

      {/* 入力フィールドのフォーカススタイル */}
      <style>
        {`
        input:focus + img {
          border: 2px solid #6D6F8C;
          border-radius: 15px;
        }
        `}
      </style>
    </div>
  );
};

export default GameSelect;
