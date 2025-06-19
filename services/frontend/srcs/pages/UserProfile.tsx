import React, { useState, useEffect, useCallback } from 'react';

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

interface Pong2Result {
  id: number;
  username: string;
  opponentUsername: string;
  result: string; // 'win' | 'lose'
  gameDate: string; // ISO string format
}

interface Pong42Result {
  id: number;
  username: string;
  rank: number;
  gameDate: string; // ISO string format
}

interface UserStats {
  username: string;
  pong2: {
    totalGames: number;
    wins: number;
    losses: number;
    winRate: number;
  };  pong42: {
    currentRank?: number;
    bestRank: number;
    totalGames: number;
    averageRank: number;
  };
}

const UserProfile: React.FC<UserProfileProps> = ({ navigate, userId }) => {
  // 状態管理 - すべてのhooksを最初に定義
  const [isFollowing, setIsFollowing] = useState(false);
  const [avatarBorderColor, setAvatarBorderColor] = useState<'green' | 'gray'>('green');
  const [showFollowButton, setShowFollowButton] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  // 戦績データ用のstate
  const [pong2Results, setPong2Results] = useState<Pong2Result[]>([]);
  const [pong42Results, setPong42Results] = useState<Pong42Result[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  // データソースの状態を追跡
  const [dataSource, setDataSource] = useState<'loading' | 'api' | 'mock' | 'error'>('loading');
  // 対戦相手のアバター情報を管理  // 対戦相手のアバター情報を管理
  const [opponentAvatars, setOpponentAvatars] = useState<{[username: string]: string}>({});

  // 対戦相手のアバターを取得する関数
  const fetchOpponentAvatar = useCallback(async (username: string): Promise<string> => {
    // 既にキャッシュされている場合は返す
    if (opponentAvatars[username]) {
      return opponentAvatars[username];
    }

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return '/images/avatar/default_avatar.png';
      }

      const response = await fetch(`/api/user-search/profile/${encodeURIComponent(username)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const avatar = result.data?.profileImage || '/images/avatar/default_avatar.png';
        
        // キャッシュに保存
        setOpponentAvatars(prev => ({
          ...prev,
          [username]: avatar
        }));
        
        return avatar;
      }
    } catch (error) {
      console.warn(`Failed to fetch avatar for ${username}:`, error);
    }

    return '/images/avatar/default_avatar.png';
  }, [opponentAvatars]);  // 戦績データを取得する関数
  const fetchResultsData = useCallback(async (targetUsername: string) => {
    if (!targetUsername) return;
    
    try {
      setResultsLoading(true);
      setDataSource('loading');
      console.log('🔄 Starting results data fetch for:', targetUsername);
      
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.error('認証トークンが見つかりません');
        setDataSource('error');
        return;
      }// 並列でデータを取得 - 正しいエンドポイントパスを使用
      console.log('🔄 Fetching data for user:', targetUsername);
      const [pong2Response, pong42Response, statsResponse] = await Promise.allSettled([
        fetch(`/api/results/pong2/${encodeURIComponent(targetUsername)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/api/results/pong42/${encodeURIComponent(targetUsername)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`/api/results/stats/${encodeURIComponent(targetUsername)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      console.log('📡 API Responses received:', {
        pong2: pong2Response.status,
        pong42: pong42Response.status,
        stats: statsResponse.status
      });      // Pong2結果の処理
      if (pong2Response.status === 'fulfilled' && pong2Response.value.ok) {
        const pong2Data = await pong2Response.value.json();
        console.log('📊 Pong2 API Response:', pong2Data);
        if (pong2Data.success) {
          console.log('✅ Pong2 data received:', pong2Data.data?.length || 0, 'records');
          setPong2Results(pong2Data.data || []);
          
          // 対戦相手のアバターを非同期で取得
          if (pong2Data.data && pong2Data.data.length > 0) {
            const uniqueOpponents = [...new Set(pong2Data.data.map((result: Pong2Result) => result.opponentUsername))];
            console.log('👥 Unique opponents found:', uniqueOpponents);
            uniqueOpponents.forEach(async (opponentUsername: string) => {
              if (opponentUsername && !opponentAvatars[opponentUsername]) {
                await fetchOpponentAvatar(opponentUsername);
              }
            });
          }
        } else {
          console.warn('❌ Pong2 API response marked as unsuccessful:', pong2Data);
          setPong2Results([]);
        }
      } else {
        console.warn('❌ Pong2結果の取得に失敗しました');
        if (pong2Response.status === 'fulfilled') {
          console.warn('Response status:', pong2Response.value.status);
          console.warn('Response headers:', [...pong2Response.value.headers.entries()]);
          try {
            const errorText = await pong2Response.value.text();
            console.warn('Response body:', errorText);
          } catch (e) {
            console.warn('Could not read response body:', e);
          }
        }
        setPong2Results([]);
      }      // Pong42結果の処理
      if (pong42Response.status === 'fulfilled' && pong42Response.value.ok) {
        const pong42Data = await pong42Response.value.json();
        console.log('📊 Pong42 API Response:', pong42Data);
        if (pong42Data.success) {
          console.log('✅ Pong42 data received:', pong42Data.data?.length || 0, 'records');
          setPong42Results(pong42Data.data || []);
        } else {
          console.warn('❌ Pong42 API response marked as unsuccessful:', pong42Data);
          setPong42Results([]);
        }
      } else {
        console.warn('❌ Pong42結果の取得に失敗しました. Status:', pong42Response.status);
        if (pong42Response.status === 'fulfilled') {
          console.warn('Response status:', pong42Response.value.status);
          console.warn('Response headers:', [...pong42Response.value.headers.entries()]);
          try {
            const errorText = await pong42Response.value.text();
            console.warn('Response body:', errorText);
          } catch (e) {
            console.warn('Could not read response body:', e);
          }
        }
        setPong42Results([]);
      }      // 統計情報の処理
      if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
        const statsData = await statsResponse.value.json();
        console.log('📊 Stats API Response:', statsData);
        if (statsData.success && statsData.data) {
          // API レスポンス構造に合わせて変換
          const convertedStats: UserStats = {
            username: statsData.data.username,
            pong2: {
              totalGames: statsData.data.pong2Stats?.totalGames || 0,
              wins: statsData.data.pong2Stats?.wins || 0,
              losses: statsData.data.pong2Stats?.losses || 0,
              winRate: statsData.data.pong2Stats?.winRate || 0,
            },
            pong42: {
              bestRank: statsData.data.pong42Stats?.bestRank || 42,
              totalGames: statsData.data.pong42Stats?.totalGames || 0,
              averageRank: statsData.data.pong42Stats?.averageRank || 42,
            }
          };
          console.log('✅ Stats data processed:', convertedStats);
          setUserStats(convertedStats);
        } else {
          console.warn('❌ Stats API response marked as unsuccessful:', statsData);
          setUserStats(null);
        }
      } else {
        console.warn('❌ 統計情報の取得に失敗しました');
        if (statsResponse.status === 'fulfilled') {
          console.warn('Response status:', statsResponse.value.status);
          console.warn('Response headers:', [...statsResponse.value.headers.entries()]);
          try {
            const errorText = await statsResponse.value.text();
            console.warn('Response body:', errorText);
          } catch (e) {
            console.warn('Could not read response body:', e);
          }
        }
        setUserStats(null);
      }    } catch (error) {
      console.error('戦績データの取得中にエラーが発生しました:', error);
      setDataSource('error');
      setPong2Results([]);
      setPong42Results([]);
      setUserStats(null);
    } finally {
      setResultsLoading(false);
      // データ取得完了後の状態を設定
      if (dataSource !== 'error') {
        setDataSource('api');
      }
    }
  }, [fetchOpponentAvatar]);

  // JWTトークンから現在のユーザー名を取得（初期化時のみ）
  useEffect(() => {
    if (initialized) return;
    
    const getCurrentUser = () => {
      try {
        const token = localStorage.getItem('authToken');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setCurrentUsername(payload.username);
        }
        setInitialized(true);
      } catch (error) {
        console.error('Failed to decode JWT token:', error);
        setInitialized(true);
      }
    };
    getCurrentUser();
  }, [initialized]);
  // JWT経由でユーザー情報を取得（初期化完了後のみ）
  useEffect(() => {
    if (!initialized) return;
    
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('authToken'); // 'jwt_token' から 'authToken' に変更
        
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
        
        console.log('👤 User API Response:', response.status, response.statusText);
        
        if (response.ok) {
          const result = await response.json();
          console.log('👤 User data received:', result);
          setUserData(result.data);
          
          // 戦績データを取得
          if (result.data?.username) {
            console.log('🔄 Triggering results data fetch for:', result.data.username);
            await fetchResultsData(result.data.username);
          }
          
          // 他のユーザーのプロフィールを見ている場合のみフレンド状態をチェック
          if (userId && result.data?.username) {
            try {
              const friendStatusResponse = await fetch(`/api/friend-search/status/${result.data.username}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });

              if (friendStatusResponse.ok) {
                const friendResult = await friendStatusResponse.json();
                setFriendshipStatus(friendResult.data);
                setIsFollowing(friendResult.data.isFollowing);
                
                // オンライン状態の判定：画面を見ている かつ 相互フォロー状態
                const isActuallyOnline = result.data.isOnline && friendResult.data.isMutual;
                setAvatarBorderColor(isActuallyOnline ? 'green' : 'gray');
              } else {
                // フレンド状態が取得できない場合は、デフォルトでオフライン扱い
                setFriendshipStatus(null);
                setIsFollowing(false);
                setAvatarBorderColor('gray');
              }
            } catch (friendError) {
              console.error('Failed to fetch friend status:', friendError);
              setFriendshipStatus(null);
              setIsFollowing(false);
              setAvatarBorderColor('gray');
            }
              // フォローボタンの表示判定: 他のユーザーかつ自分自身でない場合のみ表示
            const isNotSelf = result.data?.username !== currentUsername;
            setShowFollowButton(isNotSelf);
          } else {
            // 自分のプロフィールの場合
            setFriendshipStatus(null);
            setIsFollowing(false);
            setShowFollowButton(false);
            setAvatarBorderColor(result.data.isOnline ? 'green' : 'gray');          }

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
  }, [userId, currentUsername, initialized, fetchResultsData]);

  // 対戦相手のアバターが更新された際に再レンダリングを促す
  useEffect(() => {
    // opponentAvatarsが変更された場合、自動的に再レンダリングされます    console.log('対戦相手のアバターが更新されました:', Object.keys(opponentAvatars).length, '件');
  }, [opponentAvatars]);

  // フォロー状態の切り替え（useCallbackでメモ化）
  const toggleFollow = useCallback(async () => {
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
        });

        if (response.ok) {
          setIsFollowing(false);
          const newFriendshipStatus = friendshipStatus ? {
            ...friendshipStatus,
            isFollowing: false,
            isMutual: friendshipStatus.isFollowedBy && false
          } : null;
          setFriendshipStatus(newFriendshipStatus);
          
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
        });

        if (response.ok) {
          setIsFollowing(true);
          const newFriendshipStatus = friendshipStatus ? {
            ...friendshipStatus,
            isFollowing: true,
            isMutual: friendshipStatus.isFollowedBy && true
          } : null;
          setFriendshipStatus(newFriendshipStatus);
          
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
  }, [userData, friendshipStatus, isFollowing]);

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
  }  // 表示用データの処理
  const getDisplayName = () => {
    if (userData) return userData.username;
    return "ユーザー名不明";
  };
  
  const getDisplayImage = () => {
    if (userData) return userData.profileImage;
    return "/images/avatar/default_avatar.png";
  };const getDisplayRank = () => {
    // PONG42の最新10回の平均順位を計算
    if (pong42Results.length > 0) {
      const latest10Results = pong42Results
        .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
        .slice(0, 10);
      
      if (latest10Results.length > 0) {
        const averageRank = latest10Results.reduce((sum, result) => sum + result.rank, 0) / latest10Results.length;
        return averageRank;
      }
    }
      // フォールバック: 統計情報から平均ランクを取得、なければユーザーデータのランク
    if (userStats?.pong42?.averageRank) return userStats.pong42.averageRank;
    if (userData?.rank) return userData.rank;
    
    // データがない場合は42位（最下位）をデフォルトとして返す
    return 42;
  };// Pong42ランキング履歴の処理（API結果から生成）
  const getPong42RankHistory = () => {
    console.log('🔍 getPong42RankHistory called. pong42Results.length:', pong42Results.length);
    console.log('🔍 pong42Results:', pong42Results);
    console.log('🔍 dataSource:', dataSource);
    
    if (pong42Results.length > 1) {
      // 複数のデータがある場合のみグラフを表示
      // 最新の10件を日付降順にソート（最新が最初、古いデータが最後になるように）
      const sortedData = pong42Results
        .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime())
        .slice(0, 10)
        .reverse() // 表示用に古い順に並び替え（左が古い、右が最新）
        .map(result => ({
          date: new Date(result.gameDate).toLocaleDateString('ja-JP'),
          rank: result.rank
        }));
      
      console.log('📊 Using API data for graph (左=古い, 右=最新):', sortedData);
      return sortedData;
    }
    
    console.log('� No graph data - insufficient data points (need 2+, have:', pong42Results.length, ')');
    return [];
  };// Pong2戦績履歴の処理（API結果から生成）
  const getPong2History = () => {
    console.log('🔍 getPong2History called. pong2Results.length:', pong2Results.length);
    console.log('🔍 pong2Results:', pong2Results);
    
    if (pong2Results.length > 0) {
      const processedHistory = pong2Results
        .sort((a, b) => new Date(b.gameDate).getTime() - new Date(a.gameDate).getTime()) // 最新順
        .slice(0, 10) // 最新10件
        .map(result => {
          // result.result is 'win' or 'lose' for the current user (result.username)
          // Display as win if result.result === 'win' and result.username matches the profile user
          const profileUsername = userData?.username || currentUsername;
          const isWin = result.username === profileUsername && result.result === 'win';
          // 対戦相手のアバターを取得（キャッシュされていればそれを使用、なければデフォルト）
          const opponentAvatar = opponentAvatars[result.opponentUsername] || "/images/avatar/default_avatar.png";
          
          return {
            date: new Date(result.gameDate).toLocaleDateString('ja-JP'),
            isWin,
            opponentAvatar,
            opponentUsername: result.opponentUsername
          };
        });
      
      console.log('📊 Using API data for PONG2 history:', processedHistory);
      return processedHistory;
    }
    
    console.log('📊 No Pong2 history data available');
    return [];
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
          {/* PONG42平均ランキング（最新10回） */}          <div className="flex justify-center items-center space-x-4">
             <p className="text-8xl font-light text-gray-500 text-center">
               #{getDisplayRank().toFixed(2)}
             </p>
          </div>          {/* PONG42ランキング推移グラフ */}
          <div className="w-full h-48">
            <h3 className="text-xl font-medium text-[#5C5E7A] mb-4 text-center">PONG42 ランキング推移</h3>
            <svg className="w-full h-full" viewBox="0 0 600 100" preserveAspectRatio="none">
              {/* グリッドライン（デバッグ用） */}
              <g stroke="#e0e0e0" strokeWidth="0.5" opacity="0.3">
                {/* 水平線（順位表示用） */}
                <line x1="0" y1="10" x2="600" y2="10" />
                <text x="10" y="8" fontSize="8" fill="#666">1位</text>
                
                <line x1="0" y1="30" x2="600" y2="30" />
                <text x="10" y="28" fontSize="8" fill="#666">10位</text>
                
                <line x1="0" y1="50" x2="600" y2="50" />
                <text x="10" y="48" fontSize="8" fill="#666">21位</text>
                
                <line x1="0" y1="70" x2="600" y2="70" />
                <text x="10" y="68" fontSize="8" fill="#666">32位</text>
                
                <line x1="0" y1="90" x2="600" y2="90" />
                <text x="10" y="88" fontSize="8" fill="#666">42位</text>
              </g>              {(() => {
                const rankHistory = getPong42RankHistory();
                console.log('📈 Graph rendering - rankHistory:', rankHistory);
                
                if (rankHistory.length > 1) {
                  // ランクの最大値と最小値を取得してスケーリング
                  const ranks = rankHistory.map(item => item.rank);
                  const minRank = Math.min(...ranks);
                  const maxRank = Math.max(...ranks);
                  const rankRange = maxRank - minRank || 1;
                  
                  console.log('📈 Rank analysis:', { ranks, minRank, maxRank, rankRange });
                    // SVGポイントを生成（1位が常に上、42位が常に下）
                  const points = rankHistory.map((item, index) => {
                    const x = (index / (rankHistory.length - 1)) * 600;
                    // 1位=10px(上), 42位=90px(下) の固定スケール
                    // 範囲チェック：1-42位に制限
                    const clampedRank = Math.max(1, Math.min(42, item.rank));
                    // 修正: 1位（rank=1）が上（y=10）、42位（rank=42）が下（y=90）になるよう計算
                    const y = ((clampedRank - 1) / 41) * 80 + 10;
                    console.log(`📈 Point ${index}: date=${item.date}, rank=${item.rank}(clamped=${clampedRank}) → x=${x.toFixed(1)}, y=${y.toFixed(1)} [1位=10px(上), 42位=90px(下)]`);
                    return `${x},${y}`;
                  }).join(' ');
                    console.log('📈 SVG points:', points);
                  
                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke="#9496A6"
                        strokeWidth="2.5"
                        points={points}
                      />
                      {/* ポイントマーカー（デバッグ用） */}
                      {rankHistory.map((item, index) => {
                        const x = (index / (rankHistory.length - 1)) * 600;
                        const clampedRank = Math.max(1, Math.min(42, item.rank));
                        const y = ((clampedRank - 1) / 41) * 80 + 10;
                        return (
                          <circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="3"
                            fill="#FF6B6B"
                            stroke="#FFF"
                            strokeWidth="1"
                          />
                        );
                      })}
                    </>
                  );                } else {
                  // データが不足している場合のメッセージ
                  return (
                    <text
                      x="300"
                      y="50"
                      textAnchor="middle"
                      fontSize="16"
                      fill="#9496A6"
                    >
                      {rankHistory.length === 0 
                        ? "まだPONG42の戦績がありません" 
                        : "グラフ表示には2回以上の戦績が必要です"}
                    </text>
                  );
                }
              })()}
            </svg>
          </div>          {/* PONG2戦績リスト */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium text-[#5C5E7A] mb-4 text-center">PONG2 戦績</h3>
            
            {/* PONG2統計情報 */}
            {userStats?.pong2 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-[#9496A6]">総試合数</p>
                    <p className="text-lg font-medium text-[#5C5E7A]">{userStats.pong2.totalGames}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#9496A6]">勝利数</p>
                    <p className="text-lg font-medium text-green-600">{userStats.pong2.wins}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#9496A6]">勝率</p>
                    <p className="text-lg font-medium text-[#5C5E7A]">{(userStats.pong2.winRate * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            )}
            
            {(() => {
              const pong2History = getPong2History();
              console.log('📊 PONG2 history rendering - data length:', pong2History.length);
              
              if (pong2History.length > 0) {
                return pong2History.map((match, index) => (
                  <div key={`${match.date}-${match.opponentUsername}-${index}`} className="flex items-center justify-between py-2">
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
                      <div className="flex flex-col">
                        <span className="text-lg text-[#9496A6] tracking-wide text-center">{match.date}</span>
                        {match.opponentUsername && (
                          <span className="text-sm text-[#9496A6] opacity-75">vs {match.opponentUsername}</span>
                        )}
                      </div>
                    </div>
                    {/* 対戦相手のアバター */}
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <img
                        src={match.opponentAvatar}
                        alt="Opponent Avatar"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/avatar/default_avatar.png';
                        }}
                      />
                    </div>
                  </div>
                ));
              } else {
                // データがない場合のメッセージ
                return (
                  <div className="text-center py-8">
                    <p className="text-lg text-[#9496A6]">まだPONG2の戦績がありません</p>
                    <p className="text-sm text-[#9496A6] opacity-75 mt-2">対戦を開始すると戦績が表示されます</p>
                  </div>
                );
              }
            })()}
            
            {/* データ読み込み中の表示 */}
            {resultsLoading && (
              <div className="text-center py-4">
                <span className="text-[#9496A6]">戦績を読み込み中...</span>
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
        />      </button>

    </div>
  );
};

export default UserProfile;
