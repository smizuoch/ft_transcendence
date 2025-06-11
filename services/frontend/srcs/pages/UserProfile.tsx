import React, { useState, useEffect } from 'react';
import { followerService, useFollowerActions } from '../utils/followerService';
import { getUsernameFromToken } from '../utils/jwtUtils';

interface UserProfileProps {
  navigate: (
    page: string,
    userId?: string,
    roomNumber?: string,
    userToken?: string
  ) => void;
  userId?: string;
  userToken?: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ navigate, userId, userToken }) => {
  // 状態管理
  const [isFollowing, setIsFollowing] = useState(false);
  const [avatarBorderColor, setAvatarBorderColor] = useState<'green' | 'gray'>('green');
  const [showFollowButton, setShowFollowButton] = useState(true);
  const [followStats, setFollowStats] = useState({ followersCount: 0, followingCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState<string>("NAME");

  // followerServiceのアクション
  const { followUser, unfollowUser, checkFollowStatus } = useFollowerActions();  // Load user profile on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // userTokenがpropsから渡されている場合
        if (userToken) {
          console.log('Using userToken from props in UserProfile');

          // JWTトークンから直接usernameを取得
          const extractedUsername = getUsernameFromToken(userToken);
          if (extractedUsername) {
            console.log('Username extracted from JWT token:', extractedUsername);
            setUsername(extractedUsername);
          } else {
            console.error('Failed to extract username from JWT token');
            setUsername("NAME");
          }
        } else {
          // userTokenがない場合、localStorageからトークンを取得
          const storedToken = localStorage.getItem('authToken');
          console.log('Current stored token in UserProfile:', storedToken ? storedToken.substring(0, 50) + '...' : 'No token');

          if (storedToken) {
            // JWTトークンから直接usernameを取得
            const extractedUsername = getUsernameFromToken(storedToken);
            if (extractedUsername) {
              console.log('Username extracted from stored JWT token:', extractedUsername);
              setUsername(extractedUsername);
            } else {
              console.error('Failed to extract username from stored JWT token');
              setUsername("NAME");
            }
          } else {
            console.log('No authentication token found in UserProfile, using default name');
            setUsername("NAME");
          }
        }
      } catch (error) {
        console.error('Error loading profile in UserProfile:', error);
        setUsername("NAME");
      }
    };

    loadUserProfile();
  }, [userToken]); // userTokenが変わったら再実行

  // モックデータ
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
  };

  // コンポーネント初期化時にフォロー状態と統計を取得
  useEffect(() => {
    const loadUserData = async () => {
      if (!userId) return;

      setIsLoading(true);
      try {
        // フォロー状態を確認
        const followStatus = await checkFollowStatus(userId);
        setIsFollowing(followStatus);

        // フォロー統計を取得
        const stats = await followerService.getFollowStats(userId);
        setFollowStats(stats);
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [userId, checkFollowStatus]);

  // フォロー状態の切り替え
  const toggleFollow = async () => {
    if (!userId || isLoading) return;

    setIsLoading(true);
    try {
      let success = false;
      if (isFollowing) {
        success = await unfollowUser(userId);
        if (success) {
          setIsFollowing(false);
          setFollowStats((prev: { followersCount: number; followingCount: number }) => ({ ...prev, followersCount: prev.followersCount - 1 }));
        }
      } else {
        success = await followUser(userId);
        if (success) {
          setIsFollowing(true);
          setFollowStats((prev: { followersCount: number; followingCount: number }) => ({ ...prev, followersCount: prev.followersCount + 1 }));
        }
      }

      if (!success) {
        console.error('Failed to toggle follow status');
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#FFFFFF] min-h-screen p-4 relative font-sans text-[#5C5E7A]">
      <main className="max-w-7xl mx-auto flex justify-center items-start gap-12 pt-8">

        {/* 左側: アバターと名前 */}
        <section className="flex flex-col items-center justify-start pt-12 space-y-6">
          <div className="relative">
            {/* アバターコンテナ */}
            <div className={`w-56 h-56 rounded-full border-[8px] ${
              avatarBorderColor === 'green' ? 'border-green-400' : 'border-gray-400'
            } bg-white flex items-center justify-center p-1`}>
              <img
                src={mockData.avatar}
                alt={`${mockData.name}'s Avatar`}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            {/* フォロー/アンフォローボタン */}
            {showFollowButton && (
              <button
                onClick={toggleFollow}
                disabled={isLoading}
                className={`absolute bottom-1 -right-1 transition-transform hover:scale-105 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <img
                  src={isFollowing ? "/images/icons/unfollow.svg" : "/images/icons/follow.svg"}
                  alt={isLoading ? "Loading..." : (isFollowing ? "Unfollow" : "Follow")}
                  className="w-12 h-12"
                />
              </button>
            )}
          </div>
          <h1 className="text-6xl font-medium tracking-wider text-gray-600 text-center">{username}</h1>
        </section>

        {/* 中央: ランキング、グラフ、戦績 */}
        <section className="flex-1 max-w-2xl flex flex-col space-y-8 pt-4">
          {/* PONG42ランキング */}
          <div className="flex justify-center items-center space-x-4">
             <p className="text-8xl font-light text-gray-500 text-center">
               #{mockData.rank.toFixed(2)}
             </p>
             {/* フォロワー統計表示 */}
             <div className="text-sm text-gray-400 ml-4">
               <p>フォロワー: {followStats.followersCount}</p>
               <p>フォロー中: {followStats.followingCount}</p>
             </div>
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

      </main>

      {/* 右下: マイページボタン */}
      <button
        onClick={() => navigate('MyPage', undefined, undefined, userToken)}
        className="absolute bottom-4 right-4 transition-transform hover:scale-105"
      >
        <img
          src="/images/icons/mypage.svg"
          alt="MyPage"
          className="w-16 h-16"
        />
      </button>

      {/* デバッグ用のコントロールパネル（開発時のみ表示） */}
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
