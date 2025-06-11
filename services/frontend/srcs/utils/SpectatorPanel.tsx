import React from 'react';

interface SpectatorPanelProps {
  roomPlayers: Array<{ playerId: string; playerInfo: any; playerNumber: 1 | 2 }>;
  roomSpectators: Array<{ playerId: string; playerInfo: any; joinedAt: Date }>;
  currentUserId?: string;
  score: { player1: number; player2: number };
  gameStarted: boolean;
}

export const SpectatorPanel: React.FC<SpectatorPanelProps> = ({ 
  roomPlayers, 
  roomSpectators, 
  currentUserId,
  score,
  gameStarted 
}) => {
  return (
    <div className="absolute top-4 right-4 z-20 bg-black bg-opacity-80 p-4 rounded-lg text-white max-w-sm">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-yellow-400 mb-2">👁️ 観戦モード</h3>
        
        {/* プレイヤー情報 */}
        <div className="mb-3">
          <h4 className="text-sm font-bold text-green-400 mb-1">プレイヤー ({roomPlayers.length}/2)</h4>
          {roomPlayers.map((player) => (
            <div key={player.playerId} className="flex items-center gap-2 text-xs mb-1">
              <img 
                src={player.playerInfo.avatar || '/images/avatar/default_avatar.png'} 
                alt="avatar" 
                className="w-6 h-6 rounded-full"
              />
              <span className={`font-bold ${player.playerNumber === 1 ? 'text-blue-300' : 'text-red-300'}`}>
                P{player.playerNumber}
              </span>
              <span className="truncate max-w-20">
                {player.playerInfo.name || `Player ${player.playerNumber}`}
              </span>
              {player.playerId === currentUserId && <span className="text-yellow-300">(You)</span>}
            </div>
          ))}
          
          {roomPlayers.length < 2 && (
            <div className="text-xs text-gray-400 italic">
              プレイヤーを待機中...
            </div>
          )}
        </div>

        {/* スコア表示 */}
        {gameStarted && (
          <div className="mb-3 p-2 bg-gray-800 rounded">
            <h4 className="text-sm font-bold text-blue-300 mb-1">スコア</h4>
            <div className="flex justify-between text-sm">
              <span className="text-blue-300">P1: {score.player1}</span>
              <span className="text-red-300">P2: {score.player2}</span>
            </div>
          </div>
        )}

        {/* 観戦者リスト */}
        {roomSpectators.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-purple-400 mb-1">
              観戦者 ({roomSpectators.length})
            </h4>
            <div className="max-h-24 overflow-y-auto">
              {roomSpectators.map((spectator) => (
                <div key={spectator.playerId} className="flex items-center gap-2 text-xs mb-1">
                  <img 
                    src={spectator.playerInfo.avatar || '/images/avatar/default_avatar.png'} 
                    alt="avatar" 
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="truncate max-w-24">
                    {spectator.playerInfo.name || 'Spectator'}
                  </span>
                  {spectator.playerId === currentUserId && (
                    <span className="text-yellow-300">(You)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 観戦者向けの説明 */}
      <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-600">
        <div className="mb-1">👁️ 観戦者モード - 操作不可</div>
        <div className="mb-1">🎮 プレイヤー同士の対戦を観戦中</div>
        {!gameStarted && roomPlayers.length < 2 && (
          <div>⏳ ゲーム開始を待機中...</div>
        )}
        {gameStarted && (
          <div className="text-green-400">🟢 試合進行中</div>
        )}
      </div>
    </div>
  );
};
