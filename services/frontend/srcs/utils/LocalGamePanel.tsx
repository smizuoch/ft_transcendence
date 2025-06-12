import React from 'react';
import type { LocalClient, LocalRoomState } from './localMultiplayerService';

interface LocalGamePanelProps {
  roomState: LocalRoomState;
  score: { player1: number; player2: number };
  gameStarted: boolean;
}

export const LocalGamePanel: React.FC<LocalGamePanelProps> = ({
  roomState,
  score,
  gameStarted,
}) => {
  const { players, spectators } = roomState;

  if (!gameStarted) {
    return null; // ゲーム開始前は何も表示しない
  }

  return (
    <div className="absolute top-4 left-4 z-40 bg-black bg-opacity-60 p-4 rounded-lg text-white">
      <h3 className="text-lg font-bold mb-2">ローカル対戦</h3>
      
      {/* プレイヤー情報 */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-1">プレイヤー:</h4>
        <div className="space-y-1">
          {players.map((player, index) => (
            <div key={player.id} className="flex items-center space-x-2 text-xs">
              <img
                src={player.avatar}
                alt={player.name}
                className="w-6 h-6 rounded-full"
              />
              <span className={`${index === 0 ? 'text-blue-300' : 'text-red-300'}`}>
                {player.name}
              </span>
              <span className="text-gray-400">
                ({index === 0 ? score.player1 : score.player2}pt)
              </span>
              {player.id === 'npc-technician' && (
                <span className="text-yellow-400 text-xs">[NPC]</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 観戦者情報 */}
      {spectators.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1">観戦者:</h4>
          <div className="space-y-1">
            {spectators.map((spectator) => (
              <div key={spectator.id} className="flex items-center space-x-2 text-xs">
                <img
                  src={spectator.avatar}
                  alt={spectator.name}
                  className="w-4 h-4 rounded-full"
                />
                <span className="text-gray-300">{spectator.name}</span>
                <span className="text-gray-500">
                  (試合数: {spectator.num_of_play})
                </span>
                {!spectator.stillAlive && (
                  <span className="text-red-400 text-xs">[敗退]</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作説明 */}
      <div className="mt-4 pt-2 border-t border-gray-600">
        <div className="text-xs text-gray-400">
          <div>Player1: A/D キー</div>
          <div>Player2: ←/→ キー</div>
        </div>
      </div>
    </div>
  );
};
