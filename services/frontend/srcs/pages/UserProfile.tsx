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

interface FriendshipStatus {
  isFollowing: boolean;
  isFollowedBy: boolean;
  isMutual: boolean;
}

interface MockData {
  name: string;
  avatar: string;
  rank: number;
  pong42RankHistory: { date: string; rank: number; }[];
  pong2History: { date: string; isWin: boolean; opponentAvatar: string; }[];
}

const UserProfile: React.FC<UserProfileProps> = ({ navigate, userId }) => {
  // 状態管理
  const [isFollowing, setIsFollowing] = useState(false);
  const [avatarBorderColor, setAvatarBorderColor] = useState<'green' | 'gray'>('green');
  const [showFollowButton, setShowFollowButton] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  // JWTトークンから現在のユーザー名を取得
  useEffect(() => {
    const getCurrentUser = () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setCurrentUsername(payload.username);
        }
      } catch (error) {
        console.error('Failed to decode JWT token:', error);
      }
    };
    getCurrentUser();
  }, []);

  // JWT経由でユーザー情報を取得
  useEffect(() => {
    const fetchUserData = async () => {
      try {          const token = localStorage.getItem('authToken'); // 'jwt_token' から 'authToken' に変更
        
        if (!token) {
          setError('認証が必要です');
          setLoading(false);
          return;
        }

        // ユーザー情報を取得
        const endpoint = userId 
          ? `/api/user-search/profile/${userId}` // プロキシ経由に変更
          : '/api/user-search/me'; // プロキシ経由に変更
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          setUserData(result.data);
          
          // 他のユーザーのプロフィールを見ている場合、フレンド状態をチェック
          if (userId && result.data?.username) {
            const friendStatusResponse = await fetch(`/api/friend-search/status/${result.data.username}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });            if (friendStatusResponse.ok) {
              const friendResult = await friendStatusResponse.json();
              setFriendshipStatus(friendResult.data);
              setIsFollowing(friendResult.data.isFollowing);
              
              // オンライン状態の判定：画面を見ている かつ 相互フォロー状態
              const isActuallyOnline = result.data.isOnline && friendResult.data.isMutual;
              setAvatarBorderColor(isActuallyOnline ? 'green' : 'gray');
            } else {
              // フレンド状態が取得できない場合は、デフォルトでオフライン扱い
              setAvatarBorderColor('gray');
            }          } else {
            // 自分のプロフィールの場合は、そのままオンライン状態を使用
            setAvatarBorderColor(result.data.isOnline ? 'green' : 'gray');
          }
          
          // フォローボタンの表示判定: 他のユーザーかつ自分自身でない場合のみ表示
          const isOtherUser = !!userId && result.data?.username;
          const isNotSelf = result.data?.username !== currentUsername;
          setShowFollowButton(isOtherUser && isNotSelf);
        } else {
          setError('Failed to fetch user data');
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };    fetchUserData();
  }, [userId, currentUsername]);

  // モックデータ（フォールバック用）
  const mockData = {
    name: userId || "NAME",
    avatar: "/images/avatar/default_avatar.png",
    rank: 42.00,
    // PONG42のランキング履歴（グラフ用）
    pong42RankHistory: [
      { date: "2024/05/01", rank: 45 },
      { date: "2024/05/08", rank: 38 },
      { date: "2024/05/15", rank: 50 },
      { date: "2024/05/22", rank: 35 },
      { date: "2024/05/29", rank: 42 },
      { date: "2024/06/05", rank: 48 },
    ],
    // PONG2の対戦履歴
    pong2History: [
      { date: "yyyy / mm / dd / hh:mm", isWin: true, opponentAvatar: "/images/avatar/default_avatar1.png" },
      { date: "yyyy / mm / dd / hh:mm", isWin: false, opponentAvatar: "/images/avatar/default_avatar1.png" },
      { date: "yyyy / mm / dd / hh:mm", isWin: true, opponentAvatar: "/images/avatar/default_avatar1.png" },
      { date: "yyyy / mm / dd / hh:mm", isWin: true, opponentAvatar: "/images/avatar/default_avatar1.png" },
    ],
  };  // フォロー状態の切り替え
  const toggleFollow = async () => {
    if (!userData || !friendshipStatus) return;
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setError('認証が必要です');
        return;
      }

      if (isFollowing) {
        // アンフォロー実行
        const response = await fetch(`/api/friend-search/unfollow/${userData.username}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });        if (response.ok) {
          setIsFollowing(false);
          setFriendshipStatus(prev => prev ? {
            ...prev,
            isFollowing: false,
            isMutual: prev.isFollowedBy && false
          } : null);
          
          // 双方向フォローでなくなったため、オンライン状態に関係なくグレーに変更
          setAvatarBorderColor('gray');
        } else {
          throw new Error('アンフォローに失敗しました');
        }
      } else {
        // フォロー実行
        const response = await fetch('/api/friend-search/follow', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: userData.username })
        });        if (response.ok) {
          setIsFollowing(true);
          setFriendshipStatus(prev => prev ? {
            ...prev,
            isFollowing: true,
            isMutual: prev.isFollowedBy && true
          } : null);
          
          // 双方向フォローになった場合 かつ オンライン状態の場合のみ緑色に変更
          const newIsMutual = friendshipStatus?.isFollowedBy && true;
          const isActuallyOnline = userData.isOnline && newIsMutual;
          setAvatarBorderColor(isActuallyOnline ? 'green' : 'gray');
        } else {
          throw new Error('フォローに失敗しました');
        }
      }
    } catch (error) {
      console.error('フォロー状態の変更に失敗:', error);
      setError('フォロー状態の変更に失敗しました');
    }
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
    );
  }
  // ユーザーデータの表示（JWTデータを優先、フォールバックはモックデータ）
  const displayData = userData || mockData;
  
  // 型安全なプロパティアクセス用のヘルパー関数
  const getDisplayName = () => {
    if (userData) return userData.username;
    return mockData.name;
  };
  
  const getDisplayImage = () => {
    if (userData) return userData.profileImage;
    return mockData.avatar;
  };
  
  const getDisplayRank = () => {
    if (userData) return userData.rank || 0;
    return mockData.rank;
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
        <section className="flex-1 max-w-2xl flex flex-col space-y-8 pt-4">
          {/* PONG42ランキング */}          <div className="flex justify-center items-center space-x-4">
             <p className="text-8xl font-light text-gray-500 text-center">
               #{getDisplayRank().toFixed(2)}
             </p>
          </div>

          {/* PONG42ランキング推移グラフ */}
          <div className="w-full h-48">
             <svg className="w-full h-full" viewBox="0 0 600 100" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="#9496A6"
                strokeWidth="2.5"
                points="0,55 120,62 240,40 360,65 480,58 600,52"
              />
            </svg>
          </div>

          {/* PONG2戦績リスト */}
          <div className="space-y-4">
            {mockData.pong2History.map((match, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-6">
                  {/* 勝利時のみ表示される勝利アイコン */}
                  {match.isWin && (
                    <div className="w-10 h-10 flex items-center justify-center">
                      <img
                        src="/images/icons/win.svg"
                        alt="Win"
                        className="w-8 h-8"
                      />
                    </div>
                  )}
                  {!match.isWin && (
                    <div className="w-10 h-10"></div>
                  )}
                  <span className="text-lg text-[#9496A6] tracking-wide text-center">{match.date}</span>
                </div>
                {/* 対戦相手のアバター */}
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <img
                    src={match.opponentAvatar}
                    alt="Opponent Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ))}
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
