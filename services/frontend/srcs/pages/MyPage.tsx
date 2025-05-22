import React, { useState, useRef } from 'react';

interface MyPageProps {
  navigate: (page: string, userId?: string) => void;
}

/**
 * The component is laid out to match the reference mock exactly:
 *   • Avatar circle ~320 px wide, anchored 60 px from the left and ~120 px from the top
 *   • Username sits roughly on the horizontal mid‑line of the avatar
 *   • Search bar starts immediately to the right of the avatar, 560 px wide
 *   • Pong icon is vertically centred and pushed 20 % in from the right edge
 *   • DevOps icon stays fixed to the bottom‑right corner
 *
 * Only vanilla CSS‑in‑JS (style props) and Tailwind utility classes are used so no
 * external style sheets are required.
 */
const MyPage: React.FC<MyPageProps> = ({ navigate }) => {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const username = 'NAME'; // mock

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarSrc(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      alert(`Searching for: ${searchTerm}`);
    }
  };

  /* --------------------------------------------------------------------- */
  // Design palette – tweak here if the brand colours change later.
  const accent = '#6B6D9A';
  const avatarPlaceholder = '#A0C4FF';
  const placeholderText = '#E0E7FF';

  // Avatar diameter (scales responsively but keeps the reference ratio)
  const AVATAR = 320; // px
  /* --------------------------------------------------------------------- */

  return (
    <div className="relative flex min-h-screen w-full bg-white font-[Futura] overflow-hidden">
      {/* Left‑hand column ------------------------------------------------ */}
      <div
        className="absolute"
        style={{
          top: AVATAR * 0.35, // ≒120 px when AVATAR = 320
          left: 60,
        }}
      >
        <div className="flex items-center">
          {/* Avatar */}
          <div
            onClick={handleAvatarClick}
            className="relative rounded-full overflow-hidden cursor-pointer shrink-0"
            style={{
              width: AVATAR,
              height: AVATAR,
              backgroundColor: avatarSrc ? 'transparent' : avatarPlaceholder,
            }}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="User avatar" className="w-full h-full object-cover" />
            ) : (
              <span
                className="absolute inset-0 flex items-center justify-center"
                style={{ color: placeholderText, fontSize: 20 }}
              >
                avatar
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Name & search stack */}
          <div className="ml-10 flex flex-col" style={{ transform: `translateY(${AVATAR * 0.25}px)` }}>
            {/* Username */}
            <span
              className="font-medium whitespace-nowrap"
              style={{ color: accent, fontSize: 88, lineHeight: 1 }}
            >
              {username}
            </span>

            {/* Search bar */}
            <div className="relative mt-10" style={{ width: 560 }}>
              <img
                src="/images/icons/userserch.svg"
                alt="Search icon"
                className="absolute top-1/2 -translate-y-1/2 left-4 w-7 pointer-events-none"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full rounded-md border bg-transparent focus:outline-none"
                style={{
                  borderColor: accent,
                  height: 46,
                  paddingLeft: 48,
                  color: accent,
                  fontSize: 18,
                }}
                placeholder="Search user…"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pong icon -------------------------------------------------------- */}
      <button
        onClick={() => navigate('GameSelect')}
        className="absolute hover:opacity-80 transition-opacity"
        style={{ top: '50%', right: '20%', width: 160, transform: 'translateY(-50%)' }}
      >
        <img src="/images/icons/pong.svg" alt="Play game" className="w-full h-auto" />
      </button>

      {/* DevOps icon ------------------------------------------------------ */}
      <a
        href="http://localhost:5601"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute hover:opacity-80 transition-opacity"
        style={{ bottom: 24, right: 24, width: 48 }}
      >
        <img src="/images/icons/devops.svg" alt="DevOps" className="w-full h-auto" />
      </a>
    </div>
  );
};

export default MyPage;
