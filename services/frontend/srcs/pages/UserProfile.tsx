import React from 'react';

interface UserProfileProps {
  navigate: (page: string) => void;
  userId?: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ navigate, userId }) => {
  // モックデータ
  const mockData = {
    name: userId || "NAME",
    avatar: `https://via.placeholder.com/200x200/81B6E9/FFFFFF?Text=${userId ? userId.charAt(0).toUpperCase() : 'U'}`,
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
    // PONG2の勝敗履歴
    pong2History: [
      { date: "yyyy / mm / dd / hh:mm", result: "win" },
      { date: "yyyy / mm / dd / hh:mm", result: "loss" },
      { date: "yyyy / mm / dd / hh:mm", result: "win" },
      { date: "yyyy / mm / dd / hh:mm", result: "win" },
    ],
  };

  return (
    <div className="bg-[#F8F8FA] min-h-screen p-12 relative font-sans text-[#5C5E7A]">
      
      {/* 左上の装飾的な四角 */}
      <div className="absolute top-12 left-0 w-16 h-16 bg-[#E9E9F0]"></div>

      <main className="max-w-7xl mx-auto flex justify-center items-start gap-24">
        
        {/* 左側: アバターと名前 */}
        <section className="flex flex-col items-center justify-start pt-24 space-y-6">
          <div className="relative">
            {/* アバターコンテナ */}
            <div className="w-56 h-56 rounded-full border-[8px] border-green-400 bg-[#81B6E9] flex items-center justify-center p-1">
              <img
                src={mockData.avatar}
                alt={`${mockData.name}'s Avatar`}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            {/* フレンドアイコン */}
            <div className="absolute bottom-1 -right-1">
               <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="24" fill="#EAEAF2"/>
                <g opacity="0.8">
                  <path fillRule="evenodd" clipRule="evenodd" d="M21.3724 24.0001C18.2914 24.0001 15.801 21.5097 15.801 18.4287C15.801 15.3477 18.2914 12.8572 21.3724 12.8572C24.4534 12.8572 26.9438 15.3477 26.9438 18.4287C26.9438 21.5097 24.4534 24.0001 21.3724 24.0001ZM21.3724 26.8572C25.6338 26.8572 29.0867 30.3101 29.0867 34.5715H13.6581C13.6581 30.3101 17.111 26.8572 21.3724 26.8572Z" fill="#5C5E7A"/>
                </g>
              </svg>
            </div>
          </div>
          <h1 className="text-6xl font-medium tracking-wider text-gray-600">{mockData.name}</h1>
        </section>

        {/* 中央: ランキング、グラフ、戦績 */}
        <section className="flex-1 max-w-2xl flex flex-col space-y-12 pt-8">
          {/* PONG42ランキング */}
          <div className="flex justify-start items-center space-x-4">
             <div className="w-24 h-24 bg-[#E9E9F0]"></div>
             <p className="text-8xl font-light text-gray-500">
               #{mockData.rank.toFixed(2)}
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
                  {/* メダルアイコン */}
                   <div className="relative w-10 h-10 flex items-center">
                      <div className="absolute w-8 h-8 bg-[#E9E9F0] ml-1"></div>
                      <svg width="25" height="34" viewBox="0 0 25 34" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
                        <g>
                          <path d="M12.5 15C16.366 15 19.5 11.866 19.5 8C19.5 4.13401 16.366 1 12.5 1C8.63401 1 5.5 4.13401 5.5 8C5.5 11.866 8.63401 15 12.5 15Z" stroke="#9496A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9.5 19H15.5V33L12.5 29L9.5 33V19Z" fill="#E9E9F0" stroke="#9496A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                      </svg>
                   </div>
                  <span className="text-lg text-[#9496A6] tracking-wide">{match.date}</span>
                </div>
                {/* 勝敗アイコン */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  match.result === "win" ? "bg-green-400" : "bg-red-400"
                }`}>
                  {match.result === "win" ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* 右下: マイページボタン */}
      <button
        onClick={() => navigate('MyPage')}
        className="absolute bottom-12 right-12 transition-transform hover:scale-105"
      >
        <div className="w-16 h-16 bg-[#5C5E7A] rounded-full flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

    </div>
  );
};

export default UserProfile;
