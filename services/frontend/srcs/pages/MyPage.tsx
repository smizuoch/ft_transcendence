import React, { useRef, useState, useEffect } from "react";
import { OnlineStatusManager } from "../utils/onlineStatusManager";

interface MyPageProps {
  /**
   * Navigate helper supplied by the router
   * @param page  – destination page key
   * @param userId – optional user identifier
   */
  navigate: (page: string, userId?: string) => void;
}

interface UserData {
  userId: number;
  username: string;
  profileImage: string;
  isOnline: boolean;
}

interface SearchResult {
  username: string;
  profileImage: string;
  isOnline: boolean;
}

/**
 * Responsive implementation that reproduces the supplied mock *pixel‑perfect*.
 *
 *  • Avatar – 320 px ⌀ – positioned 60 px from the left and 120 px from the top
 *  • **Avatar and NAME are bottom‑aligned** (NAME text baseline sits on the
 *    avatar’s lower edge) and placed side‑by‑side.
 *  • Search bar – 560 px wide, begins flush with the avatar’s right edge **and
 *    sits directly under NAME**.
 *  • Pong icon – vertically centred and offset 20 % from the right edge
 *  • DevOps icon – fixed to the bottom‑right corner with extra breathing room
 *    (40 px inset)
 *
 *  Tailwind utility classes + inline styles → no external stylesheets needed.
 */
const MyPage: React.FC<MyPageProps> = ({ navigate }) => {
  /* ------------------------------------------------------------------ */  // State & refs
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResult, setShowSearchResult] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);  const searchContainerRef = useRef<HTMLDivElement>(null);
  /* ------------------------------------------------------------------ */
  // 検索結果外をクリックした時に検索結果を閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResult(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  /* ------------------------------------------------------------------ */
  // オンライン状態管理の初期化
  useEffect(() => {
    const onlineStatusManager = OnlineStatusManager.getInstance();
    onlineStatusManager.initialize();

    // コンポーネントアンマウント時のクリーンアップ
    return () => {
      onlineStatusManager.cleanup();
    };
  }, []);

  /* ------------------------------------------------------------------ */
  // Fetch user data from user_search service
  useEffect(() => {
    const fetchUserData = async () => {
      try {        const token = localStorage.getItem('authToken'); // 'jwt_token' から 'authToken' に変更
        if (!token) {
          setError('認証が必要です');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/user-search/me', { // プロキシ経由に変更
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });        if (response.ok) {
          const result = await response.json();
          setUserData(result.data);
          // プロフィール画像をアバターに設定
          if (result.data.profileImage) {
            // Base64データかファイルパスかを判断して適切に設定
            if (result.data.profileImage.startsWith('data:image/')) {
              // Base64データの場合はそのまま使用
              setAvatarSrc(result.data.profileImage);
            } else if (result.data.profileImage !== '/images/avatar/default_avatar.png') {
              // デフォルトでない場合はBase64データとして使用
              setAvatarSrc(result.data.profileImage);
            }
            // デフォルト画像の場合はavatarSrcをnullのままにしてプレースホルダーを表示
          }
        } else {
          setError('ユーザー情報の取得に失敗しました');
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('ユーザー情報の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  /* ------------------------------------------------------------------ */
  // Event handlers
  const handleAvatarClick = () => fileInputRef.current?.click();
  const handleAvatarPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      setAvatarSrc(base64Image);
      
      // プロフィール画像をデータベースに保存
      try {
        const token = localStorage.getItem('authToken');
        if (token) {          const response = await fetch('/api/user-search/profile-image', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ profileImage: base64Image })
          });

          console.log(`[DEBUG] Profile image upload response status: ${response.status}`);

          if (response.ok) {
            const result = await response.json();
            console.log('Profile image updated successfully:', result);
            console.log(`[DEBUG] Response image length: ${result.data?.profileImage?.length || 0}`);
            
            // ユーザーデータを更新
            if (userData) {
              setUserData({
                ...userData,
                profileImage: base64Image
              });
            }
          } else {
            const errorText = await response.text();
            console.error('Failed to update profile image. Response:', errorText);
          }
        }
      } catch (error) {
        console.error('Error updating profile image:', error);
      }
    };
    reader.readAsDataURL(file);
  };
  const handleSearch = async () => {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) {
      setShowSearchResult(false);
      setSearchResult(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        setSearchError('認証が必要です');
        return;
      }

      const response = await fetch(`/api/user-search/profile/${encodeURIComponent(trimmedTerm)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSearchResult(result.data);
        setShowSearchResult(true);
        setSearchError(null);
      } else if (response.status === 404) {
        setSearchResult(null);
        setSearchError('ユーザーが見つかりませんでした');
        setShowSearchResult(true);
      } else {
        setSearchResult(null);
        setSearchError('検索に失敗しました');
        setShowSearchResult(true);
      }
    } catch (error) {
      console.error('Error searching user:', error);
      setSearchResult(null);
      setSearchError('検索中にエラーが発生しました');
      setShowSearchResult(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSelect = (username: string) => {
    navigate("UserProfile", username);
    setShowSearchResult(false);
    setSearchTerm("");
  };
  /* ------------------------------------------------------------------ */
  // Design tokens – tweak once, propagate everywhere
  const accent = "#6B6D9A";
  const avatarPlaceholder = "#A0C4FF";
  const placeholderText = "#E0E7FF";

  const AVATAR = 320; // px
  const NAME_SIZE = 88; // px – keeps maths readable

  // ローディング状態の表示
  if (loading) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-white">
        <p className="text-2xl" style={{ color: accent }}>Loading...</p>
      </div>
    );
  }

  // エラー状態の表示
  if (error) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center bg-white">
        <p className="text-2xl text-red-500">{error}</p>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white font-[Futura]">
      {/* ---------------------------------------------------------------- */}
      {/* Avatar + NAME / search cluster                                   */}
      {/* ---------------------------------------------------------------- */}
      <div
        className="absolute flex"
        style={{ top: 120, left: 60 }}
      >
        {/* Avatar --------------------------------------------------------- */}        <div
          onClick={handleAvatarClick}
          className="relative shrink-0 cursor-pointer overflow-hidden rounded-full"
          style={{ width: AVATAR, height: AVATAR, backgroundColor: avatarSrc ? "transparent" : avatarPlaceholder }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="User avatar" className="h-full w-full object-cover" />
          ) : (
            <span
              className="absolute inset-0 flex select-none items-center justify-center"
              style={{ color: placeholderText, fontSize: 20 }}
            >
              avatar
            </span>
          )}

          {/* オンラインステータスインジケーター */}
          {userData && (
            <div
              className="absolute bottom-2 right-2 rounded-full border-4 border-white"
              style={{
                width: 32,
                height: 32,
                backgroundColor: userData.isOnline ? "#22C55E" : "#9CA3AF"
              }}
            />
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarPicked}
            className="hidden"
          />
        </div>

        {/* NAME + search stack ------------------------------------------- */}
        <div
          className="ml-10 flex flex-col"
          /* Shift the stack so that the bottom of the NAME text aligns with
             the bottom of the avatar.  NAME font-size = 88 px so we move the
             whole stack down by (AVATAR - NAME_SIZE) = 232 px. */
          style={{ transform: `translateY(${AVATAR - NAME_SIZE}px)` }}
        >          {/* NAME */}
          <button
            onClick={() => navigate("UserProfile", userData?.username || "myusername")}
            className="whitespace-nowrap text-left font-medium transition-opacity hover:opacity-80"
            style={{ color: accent, fontSize: NAME_SIZE, lineHeight: 1 }}
          >
            {userData?.username || "NAME"}
          </button>          {/* Search bar */}
          <div ref={searchContainerRef} className="relative mt-10" style={{ width: 560 }}>
            {/* Icon */}
            <img
              src="/images/icons/userserch.svg"
              alt="Search"
              className="pointer-events-none absolute left-4 top-1/2 w-7 -translate-y-1/2"
            />

            {/* Text input */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                // リアルタイム検索は負荷が高いので、Enterキーでのみ検索
                if (!e.target.value.trim()) {
                  setShowSearchResult(false);
                  setSearchResult(null);
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full rounded-md border bg-transparent focus:outline-none"
              style={{
                borderColor: accent,
                height: 46,
                paddingLeft: 48,
                color: accent,
                fontSize: 18,
              }}
              placeholder="ユーザー名を入力してEnterキーを押してください"
            />

            {/* 検索結果ドロップダウン */}
            {showSearchResult && (
              <div
                className="absolute top-full left-0 mt-1 w-full bg-white rounded-md border shadow-lg z-10"
                style={{ borderColor: accent }}
              >
                {isSearching ? (
                  <div className="p-4 text-center" style={{ color: accent }}>
                    検索中...
                  </div>
                ) : searchError ? (
                  <div className="p-4 text-center text-red-500">
                    {searchError}
                  </div>
                ) : searchResult ? (
                  <div
                    onClick={() => handleUserSelect(searchResult.username)}
                    className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    {/* ユーザーアバター */}
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-4 bg-gray-200">
                      {searchResult.profileImage && searchResult.profileImage !== '/images/avatar/default_avatar.png' ? (
                        <img 
                          src={searchResult.profileImage} 
                          alt={`${searchResult.username}'s avatar`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          avatar
                        </div>
                      )}
                    </div>
                    
                    {/* ユーザー情報 */}
                    <div className="flex-1">
                      <div className="font-medium text-lg" style={{ color: accent }}>
                        {searchResult.username}
                      </div>
                      <div className="text-sm text-gray-500">
                        {searchResult.isOnline ? (
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                            オンライン
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                            オフライン
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Pong icon – centred vertically, 20 % from the right               */}
      {/* ---------------------------------------------------------------- */}
      <button
        onClick={() => navigate("GameSelect")}
        className="absolute transition-opacity hover:opacity-80"
        style={{ top: "50%", right: "20%", width: 160, transform: "translateY(-50%)" }}
      >
        <img src="/images/icons/pong.svg" alt="Play game" className="h-auto w-full" />
      </button>

      {/* ---------------------------------------------------------------- */}
      {/* DevOps icon – bottom‑right with wider margin                       */}
      {/* ---------------------------------------------------------------- */}      <a
        href={`https://${import.meta.env.VITE_HOST_IP || '10.16.2.10'}:5601`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute transition-opacity hover:opacity-80"
        style={{ bottom: 40, right: 40, width: 48 }}
      >
        <img src="/images/icons/devops.svg" alt="DevOps" className="h-auto w-full" />
      </a>
    </div>
  );
};

export default MyPage;
