import React, { useRef, useState } from "react";

interface MyPageProps {
  /**
   * Navigate helper supplied by the router
   * @param page  – destination page key
   * @param userId – optional user identifier
   */
  navigate: (page: string, userId?: string) => void;
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
  /* ------------------------------------------------------------------ */
  // State & refs
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        >
          {/* NAME */}
          <button
            onClick={() => navigate("UserProfile", "myusername")}
            className="whitespace-nowrap text-left font-medium transition-opacity hover:opacity-80"
            style={{ color: accent, fontSize: NAME_SIZE, lineHeight: 1 }}
          >
            NAME
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
      {/* ---------------------------------------------------------------- */}
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
