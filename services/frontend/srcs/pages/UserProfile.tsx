import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  navigate: (page: string) => void;
  userId?: string;
}

interface UserData {
  userId: number;
  username: string;
  profileImage: string;
  isOnline: boolean;
  rank?: number;
}

// result_searchサービスのAPIレスポンス型
interface Pong2Result {
  id: number;
  username: string;
  opponentUsername: string;
  result: 'win' | 'lose';
  gameDate: string;
}

interface Pong42Result {
  id: number;
  username: string;
  rank: number;
  gameDate: string;
}

interface Pong2Stats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  recentGames: Pong2Result[];
}

interface Pong42Stats {
  totalGames: number;
  bestRank: number;
  averageRank: number;
  recentGames: Pong42Result[];
}

interface UserStats {
  username: string;
  pong2Stats: Pong2Stats;
  pong42Stats: Pong42Stats;
}

interface APIResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ navigate, userId }) => {
  // 状態管理
  const [isFollowing, setIsFollowing] = useState(false);
  const [avatarBorderColor, setAvatarBorderColor] = useState<'green' | 'gray'>('green');
  const [showFollowButton, setShowFollowButton] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [pong42History, setPong42History] = useState<Pong42Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // JWT経由でユーザー情報を取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setError('Authentication token not found');
          return;
        }

        // ユーザー基本情報を取得
        const userEndpoint = userId 
          ? `/api/user-search/profile/${userId}`
          : '/api/user-search/me';
        
        const userResponse = await fetch(userEndpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!userResponse.ok) {
          setError('Failed to fetch user data');
          return;
        }

        const userResult = await userResponse.json();
        setUserData(userResult.data);
        setAvatarBorderColor(userResult.data.isOnline ? 'green' : 'gray');
        setShowFollowButton(!!userId);

        // 対戦統計情報を取得
        const targetUsername = userId || userResult.data.username;
        const statsResponse = await fetch(`/api/results/stats/${targetUsername}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (statsResponse.ok) {
          const statsResult = await statsResponse.json();
          setUserStats(statsResult.data);
        }

        // PONG42の履歴データを取得（グラフ用）
        const pong42Response = await fetch(`/api/results/pong42/${targetUsername}?limit=20`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (pong42Response.ok) {
          const pong42Result = await pong42Response.json();
          setPong42History(pong42Result.data);
        }

      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);
  // PONG42のランキング推移グラフを生成する関数
  const generateRankingGraph = () => {
    if (!pong42History || pong42History.length === 0) {
      return "0,50 100,50 200,50 300,50 400,50 500,50"; // デフォルトライン
    }

    // 日付でソートして最新20件を使用
    const sortedHistory = [...pong42History]
      .sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime())
      .slice(-6); // 最新6件を使用

    if (sortedHistory.length < 2) {
      return "0,50 100,50 200,50 300,50 400,50 500,50";
    }

    // ランクを0-100の範囲にマッピング（1位=100、42位=0）
    const points = sortedHistory.map((result, index) => {
      const x = (index / (sortedHistory.length - 1)) * 600;
      const y = 100 - ((result.rank - 1) / 41) * 100; // 1-42を100-0にマッピング
      return `${x},${y}`;
    });

    return points.join(' ');
  };

  // フォロー状態の切り替え
  const toggleFollow = () => {
    setIsFollowing(!isFollowing);
  };

  // ローディング状態の表示
  if (loading) {
    return (
      <div className="bg-[#FFFFFF] min-h-screen flex items-center justify-center">
        <p className="text-2xl text-gray-500">Loading...</p>
      </div>
    );
  }

  // エラー状態の表示
  if (error) {
    return (
      <div className="bg-[#FFFFFF] min-h-screen flex items-center justify-center">
        <p className="text-2xl text-red-500">{error}</p>
      </div>
    );  }
  
  // 型安全なプロパティアクセス用のヘルパー関数
  const getDisplayName = () => {
    if (userData) return userData.username;
    return "Unknown User";
  };
  
  const getDisplayImage = () => {
    if (userData) return userData.profileImage;
    return "/images/avatar/default_avatar.png";
  };
  
  const getDisplayRank = () => {
    if (userStats && userStats.pong42Stats.bestRank > 0) {
      return userStats.pong42Stats.bestRank;
    }
    return 0;
  };

  // 日付フォーマット関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, ' / ');
  };return (
    <div className="bg-[#FFFFFF] min-h-screen p-4 relative font-sans text-[#5C5E7A]">
      <main className="max-w-7xl mx-auto flex justify-center items-start gap-12 pt-8">        {/* 左側: アバターと名前 */}
        <section className="flex flex-col items-center justify-start pt-12 space-y-6">
          <div className="relative">
            {/* アバターコンテナ */}            <div className={`w-56 h-56 rounded-full border-[8px] ${
              avatarBorderColor === 'green' ? 'border-green-400' : 'border-gray-400'
            } bg-white flex items-center justify-center p-1`}>              <img
                src={getDisplayImage()}
                alt={`${getDisplayName()}'s Avatar`}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            {/* フォロー/アンフォローボタン */}
            {showFollowButton && (
              <button
                onClick={toggleFollow}
                className="absolute bottom-1 -right-1 transition-transform hover:scale-105"
              >
                <img
                  src={isFollowing ? "/images/icons/unfollow.svg" : "/images/icons/follow.svg"}
                  alt={isFollowing ? "Unfollow" : "Follow"}
                  className="w-12 h-12"
                />
              </button>
            )}
          </div>          <h1 className="text-6xl font-medium tracking-wider text-gray-600 text-center">
            {getDisplayName()}
          </h1>
        </section>        {/* 中央: ランキング、グラフ、戦績 */}
        <section className="flex-1 max-w-2xl flex flex-col space-y-8 pt-4">          {/* PONG42ランキング */}
          <div className="flex justify-center items-center space-x-4">
             <p className="text-8xl font-light text-gray-500 text-center">
               #{getDisplayRank() || "N/A"}
             </p>
          </div>

          {/* 統計情報 */}
          {userStats && (
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-700 mb-2">PONG2 統計</h3>
                <p className="text-sm text-gray-600">総試合数: {userStats.pong2Stats.totalGames}</p>
                <p className="text-sm text-gray-600">勝利: {userStats.pong2Stats.wins}</p>
                <p className="text-sm text-gray-600">敗北: {userStats.pong2Stats.losses}</p>
                <p className="text-sm text-gray-600">勝率: {userStats.pong2Stats.winRate.toFixed(1)}%</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-700 mb-2">PONG42 統計</h3>
                <p className="text-sm text-gray-600">総試合数: {userStats.pong42Stats.totalGames}</p>
                <p className="text-sm text-gray-600">最高順位: #{userStats.pong42Stats.bestRank}</p>
                <p className="text-sm text-gray-600">平均順位: #{userStats.pong42Stats.averageRank.toFixed(1)}</p>
              </div>
            </div>
          )}

          {/* PONG42ランキング推移グラフ */}
          <div className="w-full h-48">
             <svg className="w-full h-full" viewBox="0 0 600 100" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="#9496A6"
                strokeWidth="2.5"
                points={generateRankingGraph()}
              />
            </svg>
          </div>

          {/* PONG2戦績リスト */}
          <div className="space-y-4">
            {userStats?.pong2Stats.recentGames?.map((match, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-6">
                  {/* 勝利時のみ表示される勝利アイコン */}
                  {match.result === 'win' && (
                    <div className="w-10 h-10 flex items-center justify-center">
                      <img
                        src="/images/icons/win.svg"
                        alt="Win"
                        className="w-8 h-8"
                      />
                    </div>
                  )}
                  {match.result === 'lose' && (
                    <div className="w-10 h-10"></div>
                  )}
                  <span className="text-lg text-[#9496A6] tracking-wide text-center">
                    {formatDate(match.gameDate)}
                  </span>
                </div>
                {/* 対戦相手の情報 */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{match.opponentUsername}</span>
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                    <img
                      src="/images/avatar/default_avatar1.png"
                      alt="Opponent Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
            {(!userStats?.pong2Stats.recentGames || userStats.pong2Stats.recentGames.length === 0) && (
              <div className="text-center text-gray-500 py-8">
                対戦履歴がありません
              </div>
            )}
          </div>
        </section>

      </main>      {/* 右下: マイページボタン */}
      <button
        onClick={() => navigate('MyPage')}
        className="absolute bottom-4 right-4 transition-transform hover:scale-105"
      >
        <img
          src="/images/icons/mypage.svg"
          alt="MyPage"
          className="w-16 h-16"
        />
      </button>      {/* デバッグ用のコントロールパネル（開発時のみ表示） */}
      <div className="absolute top-2 right-2 space-y-2 text-sm">
        <button
          onClick={() => setAvatarBorderColor(avatarBorderColor === 'green' ? 'gray' : 'green')}
          className="block px-3 py-1 bg-blue-500 text-white rounded"
        >
          アバター縁色切替: {avatarBorderColor}
        </button>
        <button
          onClick={() => setShowFollowButton(!showFollowButton)}
          className="block px-3 py-1 bg-purple-500 text-white rounded"
        >
          フォローボタン: {showFollowButton ? '表示' : '非表示'}
        </button>
      </div>

    </div>
  );
};

export default UserProfile;
