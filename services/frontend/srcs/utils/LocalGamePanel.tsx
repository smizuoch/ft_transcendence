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
  const { players, spectators, tournament } = roomState;

  if (!gameStarted) {
    return null; // ゲーム開始前は何も表示しない
  }

  // トーナメントの現在のマッチ情報を取得
  const getCurrentMatchInfo = () => {
    if (tournament) {
      switch (tournament.currentMatch) {
        case 'semifinal1':
          return { stage: 'Semifinal 1', room: tournament.semifinal1.roomNumber };
        case 'semifinal2':
          return { stage: 'Semifinal 2', room: tournament.semifinal2.roomNumber };
        case 'final':
          return { stage: 'Final', room: tournament.final?.roomNumber || 'N/A' };
        default:
          return { stage: 'Unknown', room: roomState.roomNumber };
      }
    }
    return null;
  };

  const matchInfo = getCurrentMatchInfo();

  return (
    <div className="absolute top-4 left-4 z-40 bg-black bg-opacity-60 p-4 rounded-lg text-white">
      <h3 className="text-lg font-bold mb-2">🏆 ローカルトーナメント</h3>

      {/* トーナメント情報 */}
      {tournament && matchInfo && (
        <div className="mb-3 text-sm">
          <div className="text-yellow-400 font-semibold">
            {matchInfo.stage} (部屋: {matchInfo.room})
          </div>
        </div>
      )}

      {/* 残り生存者数 */}
      <div className="mb-3 text-sm">
        <span className="text-green-400">
          残り参加者: {roomState.clients.filter(c => c.stillAlive && c.id !== 'npc-technician').length}人
        </span>
      </div>

      {/* プレイヤー情報 */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-1">🥊 対戦中:</h4>
        <div className="space-y-1">
          {players.map((player, index) => (
            <div key={player.id} className="flex items-center space-x-2 text-xs">
              <img
                src={player.avatar}
                alt={player.name}
                className="w-6 h-6 rounded-full"
              />
              <span className={`font-bold ${index === 0 ? 'text-blue-300' : 'text-red-300'}`}>
                {player.name}
              </span>
              <span className="text-gray-400">
                ({index === 0 ? score.player1 : score.player2}pt)
              </span>
              <span className="text-yellow-400 text-xs">
                [{player.num_of_play}試合目]
              </span>
              {player.id === 'npc-technician' && (
                <span className="text-orange-400 text-xs">[NPC]</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 観戦者情報 */}
      {spectators.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-1">👥 待機中:</h4>
          <div className="space-y-1">
            {spectators.map((spectator) => (
              <div key={spectator.id} className="flex items-center space-x-2 text-xs">
                <img
                  src={spectator.avatar}
                  alt={spectator.name}
                  className="w-4 h-4 rounded-full"
                />
                <span className={`${spectator.stillAlive ? 'text-gray-300' : 'text-red-400'}`}>
                  {spectator.name}
                </span>
                <span className="text-gray-500">
                  ({spectator.num_of_play}試合)
                </span>
                {!spectator.stillAlive && (
                  <span className="text-red-400 text-xs">[敗退]</span>
                )}
                {spectator.stillAlive && (
                  <span className="text-green-400 text-xs">[次戦候補]</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作説明 */}
      <div className="mt-4 pt-2 border-t border-gray-600">
        <div className="text-xs text-gray-400">
          <div>Player1 (青): A/D キー</div>
          <div>Player2 (赤): ←/→ キー</div>
        </div>
      </div>
    </div>
  );
};
