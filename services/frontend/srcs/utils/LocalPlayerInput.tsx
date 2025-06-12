import React, { useState } from 'react';
import type { LocalClient } from './localMultiplayerService';

interface LocalPlayerInputProps {
  onPlayersConfirmed: (clients: LocalClient[]) => void;
  onCancel: () => void;
}

export const LocalPlayerInput: React.FC<LocalPlayerInputProps> = ({
  onPlayersConfirmed,
  onCancel,
}) => {
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', '', '']);

  const handleNameChange = (index: number, value: string) => {
    const newNames = [...playerNames];
    newNames[index] = value;
    setPlayerNames(newNames);
  };

  const handleConfirm = () => {
    // 空でない名前のみ取得
    const validNames = playerNames.filter(name => name.trim() !== '');

    if (validNames.length === 0) {
      alert('少なくとも1人の名前を入力してください');
      return;
    }

    if (validNames.length > 4) {
      alert('参加者は最大4人までです');
      return;
    }

    // LocalClientオブジェクトを作成
    const clients: LocalClient[] = validNames.map((name, index) => ({
      id: `local-client-${index}`,
      name: name.trim(),
      num_of_play: 0,
      stillAlive: true,
      avatar: `/images/avatar/default_avatar${index % 2}.png`, // アバターを交互に設定
    }));

    onPlayersConfirmed(clients);
  };

  const validPlayerCount = playerNames.filter(name => name.trim() !== '').length;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 z-50">
      <div className="bg-black bg-opacity-50 p-8 rounded-lg border-2 border-white">
        <h2 className="text-3xl text-white mb-4 text-center">🏆 ローカルトーナメント</h2>
        <div className="text-center mb-6">
          <p className="text-white mb-2">最大4人でトーナメント対戦</p>
          <div className="text-sm text-gray-300 space-y-1">
            <p>• 2人ずつ対戦し、敗者は脱落</p>
            <p>• 観戦者は次の対戦でプレイヤーになります</p>
            <p>• 最後の1人が決まるまで続きます</p>
          </div>
        </div>

        <div className="space-y-4">
          {playerNames.map((name, index) => (
            <div key={index} className="flex items-center space-x-3">
              <span className="text-white w-16">Player {index + 1}:</span>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                placeholder={index === 0 ? "必須" : "オプション"}
                maxLength={20}
                className="px-3 py-2 text-lg bg-transparent border-2 border-white text-white placeholder-gray-400 rounded focus:outline-none focus:border-yellow-400"
              />
            </div>
          ))}
        </div>

        <div className="text-center mt-6">
          <p className="text-white mb-2">
            参加者数: {validPlayerCount}人
          </p>
          {validPlayerCount % 2 === 1 && (
            <p className="text-yellow-400 mb-4 text-sm">
              ⚠️ 奇数のためTechnicianNPCが自動追加されます
            </p>
          )}
          {validPlayerCount >= 3 && (
            <div className="text-green-400 mb-4 text-sm">
              ✅ トーナメント開始可能！
              <br />
              🥊 最初の2人が対戦、残りは観戦者として待機
            </div>
          )}

          <div className="flex space-x-4 justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-3 text-lg bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              disabled={validPlayerCount === 0}
              className="px-6 py-3 text-lg bg-white text-black rounded hover:bg-gray-200 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              トーナメント開始
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
