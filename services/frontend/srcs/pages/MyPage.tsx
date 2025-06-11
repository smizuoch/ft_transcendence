import React, { useRef, useState, useEffect } from "react";
import { apiClient } from '../utils/authApiClient';

interface MyPageProps {
  /**
   * Navigate helper supplied by the router
   * @param page  – destination page key
   * @param userId – optional user identifier
   */
  navigate: (
    page: string,
    userId?: string,
    roomNumber?: string,
    userToken?: string
  ) => void;
  /**
   * User token for authentication
   */
  userToken?: string;
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
const MyPage: React.FC<MyPageProps> = ({ navigate, userToken }) => {
  /* ------------------------------------------------------------------ */
  // State & refs
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [username, setUsername] = useState<string>("NAME");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);  /* ------------------------------------------------------------------ */  // Load user profile on component mount
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsLoadingProfile(true);

        // まずuserTokenがpropsから渡されているかチェック
        if (userToken) {
          console.log('Using userToken from props');

          // トークンを保存
          localStorage.setItem('authToken', userToken);

          // トークンを使ってプロフィール取得
          const response = await apiClient.getProfile();
          console.log('Profile API response:', response);

          if (response.success && response.data) {
            const newUsername = response.data.username || "NAME";
            console.log('Setting username to:', newUsername);
            setUsername(newUsername);
            console.log('Profile loaded successfully from token:', response.data);
            return;
          }
        }

        // userTokenがない場合、既存のトークンチェック
        const token = apiClient.getStoredToken();
        console.log('Current stored token:', token ? token.substring(0, 50) + '...' : 'No token');

        if (!token) {
          // トークンがない場合はデフォルトのままで処理終了
          console.log('No authentication token found, using default name');
          setUsername("NAME");
          return;
        }

        const response = await apiClient.getProfile();
        console.log('Profile API response:', response);

        if (response.success && response.data) {
          // JWTトークンのペイロードから username を取得
          const newUsername = response.data.username || "NAME";
          console.log('Setting username to:', newUsername);          setUsername(newUsername);
          console.log('Profile loaded successfully:', response.data);
        } else {
          console.error('Failed to load profile:', response.message);
          // プロフィール取得に失敗した場合は "NAME" のまま
          setUsername("NAME");
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setUsername("NAME");
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [userToken]); // userTokenが変わったら再実行

  /* ------------------------------------------------------------------ */
  // Event handlers
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setAvatarSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) return;
    alert(`Searching for: ${searchTerm}`);
    // Future: navigate("UserProfile", searchTerm)
  };

  // デバッグ用：トークンをクリアして再読み込み
  const handleClearToken = () => {
    apiClient.logout();
    console.log('Token cleared, reloading...');
    window.location.reload();
  };

  /* ------------------------------------------------------------------ */
  // Design tokens – tweak once, propagate everywhere
  const accent = "#6B6D9A";
  const avatarPlaceholder = "#A0C4FF";
  const placeholderText = "#E0E7FF";

  const AVATAR = 320; // px
  const NAME_SIZE = 88; // px – keeps maths readable

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
        {/* Avatar --------------------------------------------------------- */}
        <div
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
        >          {/* NAME */}          <button
            onClick={() => navigate("UserProfile", username.toLowerCase(), undefined, userToken)}
            className="whitespace-nowrap text-left font-medium transition-opacity hover:opacity-80"
            style={{ color: accent, fontSize: NAME_SIZE, lineHeight: 1 }}
          >
            {isLoadingProfile ? "Loading..." : username}
          </button>

          {/* Search bar */}
          <div className="relative mt-10" style={{ width: 560 }}>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full rounded-md border bg-transparent focus:outline-none"
              style={{
                borderColor: accent,
                height: 46,
                paddingLeft: 48,
                color: accent,
                fontSize: 18,
              }}
            />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Pong icon – centred vertically, 20 % from the right               */}
      {/* ---------------------------------------------------------------- */}      <button
        onClick={() => navigate("GameSelect", undefined, undefined, userToken)}
        className="absolute transition-opacity hover:opacity-80"
        style={{ top: "50%", right: "20%", width: 160, transform: "translateY(-50%)" }}
      >
        <img src="/images/icons/pong.svg" alt="Play game" className="h-auto w-full" />
      </button>

      {/* ---------------------------------------------------------------- */}
      {/* DevOps icon – bottom‑right with wider margin                       */}
      {/* ---------------------------------------------------------------- */}

      {/* Debug button - temporary for testing authentication */}
      <button
        onClick={handleClearToken}
        className="absolute transition-opacity hover:opacity-80 bg-red-500 text-white px-3 py-1 rounded text-sm"
        style={{ top: 10, right: 10 }}
        title="Clear token and reload"
      >
        Clear Token
      </button>

      <a
        href="https://localhost:5601"
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
