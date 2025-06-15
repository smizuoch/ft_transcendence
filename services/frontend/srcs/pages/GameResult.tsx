import React, { useState, useEffect } from "react";

interface PlayerInfo {
  id: number | string;
  avatar: string;
  name: string;
}

interface GameResultProps {
  navigate: (page: string, userId?: string, roomNumber?: string) => void;
  gameMode?: 'Pong2' | 'Pong4' | 'Pong42';
  winner?: PlayerInfo;
  gameResult?: {
    winner: PlayerInfo;
    gameMode: 'Pong2' | 'Pong4' | 'Pong42';
    finalScore?: { player1: number; player2: number };
  };
}

// デモ用のランキングデータ
const generateDemoRanking = (gameMode: 'Pong2' | 'Pong4' | 'Pong42' = 'Pong2'): PlayerInfo[] => {
  const demoPlayers: PlayerInfo[] = [];
  
  for (let i = 1; i <= 42; i++) {
    // アバター画像のパスを修正（デフォルトアバターを使用）
    const avatarIndex = (i % 2) + 1; // 1または2
    demoPlayers.push({
      id: i,
      avatar: `/images/avatar/default_avatar${avatarIndex === 1 ? '' : avatarIndex}.png`,
      name: `NAME`
    });
  }
  
  return demoPlayers;
};

const GameResult: React.FC<GameResultProps> = ({ 
  navigate, 
  gameMode = 'Pong2', 
  winner,
  gameResult 
}) => {
  const [ranking, setRanking] = useState<PlayerInfo[]>([]);

  // 背景画像を決定
  const getBackgroundImage = () => {
    switch (gameMode) {
      case 'Pong42':
        return '/images/background/daybreak.png';
      case 'Pong2':
      case 'Pong4':
      default:
        return '/images/background/noon.png';
    }
  };  // 初期化時にランキングデータを設定
  useEffect(() => {
    // localStorageからゲーム結果を取得
    const storedGameResult = localStorage.getItem('gameResult');
    let parsedGameResult = null;
    
    if (storedGameResult) {
      try {
        parsedGameResult = JSON.parse(storedGameResult);
        // 使用後は削除
        localStorage.removeItem('gameResult');
      } catch (error) {
        console.error('Failed to parse game result from localStorage:', error);
      }
    }
    
    const effectiveGameMode = parsedGameResult?.gameMode || gameMode;
    const demoRanking = generateDemoRanking(effectiveGameMode as 'Pong2' | 'Pong4' | 'Pong42');
    
    // ゲーム結果がある場合、勝者を1位に設定
    const resultToUse = parsedGameResult || gameResult;
    if (resultToUse?.winner) {
      const updatedRanking = [...demoRanking];
      // 勝者を1位に移動
      const winnerIndex = updatedRanking.findIndex(p => p.id === resultToUse.winner.id);
      if (winnerIndex > 0) {
        const winnerPlayer = updatedRanking.splice(winnerIndex, 1)[0];
        updatedRanking.unshift(winnerPlayer);
      } else if (winnerIndex === -1) {
        // 勝者が既存のランキングにない場合、新しく追加
        updatedRanking.unshift(resultToUse.winner);
        updatedRanking.pop(); // 最後の要素を削除して42人を維持
      }
      setRanking(updatedRanking);
    } else {
      setRanking(demoRanking);
    }
  }, [gameMode, gameResult]);

  const handleMyPageClick = () => {
    navigate("MyPage");
  };

  return (
    <div className="relative w-full h-screen overflow-hidden font-[Futura]">
      {/* 背景画像 */}
      <img
        src={getBackgroundImage()}
        alt="bg"
        className="absolute inset-0 w-full h-full object-cover"
      />      {/* 中央のランキングパネル */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: "90vmin", height: "90vmin" }}>
          <div className="w-full h-full border border-white overflow-hidden">
            {/* ランキングリスト */}
            <div className="h-full overflow-y-auto p-8">
              {ranking.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center py-4 border-b border-gray-200 last:border-b-0"
                >
                  {/* 順位またはアイコン */}
                  <div className="w-12 h-12 flex items-center justify-center mr-6">
                    {index === 0 ? (
                      <img
                        src="/images/icons/win.svg"
                        alt="1st place"
                        className="w-8 h-8"
                      />
                    ) : (
                      <span className="text-3xl font-bold text-white">
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* プレイヤーアバター */}
                  <div className="w-12 h-12 mr-6">
                    <img
                      src={player.avatar}
                      alt={`${player.name} avatar`}
                      className="w-full h-full rounded-full object-cover border-2 border-gray-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/avatar/default_avatar.png';
                      }}
                    />
                  </div>

                  {/* プレイヤー名 */}
                  <div className="flex-1">
                    <span className="text-3xl font-bold text-white tracking-wider">
                      {player.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>{/* マイページボタン */}
      <button
        onClick={handleMyPageClick}
        className="absolute bottom-16 right-16 hover:opacity-80 transition-opacity"
        aria-label="Back to My Page"
      >
        <img src="/images/icons/mypage.svg" alt="MyPage" className="w-16 h-16" />
      </button>
    </div>
  );
};

export default GameResult;
