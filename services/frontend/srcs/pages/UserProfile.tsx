import React from 'react';

interface UserProfileProps {
  navigate: (page: string) => void;
  userId?: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ navigate, userId }) => {
  const isOwnProfile = userId === "myusername"; // モック: "myusername" が自分のプロファイルだと仮定

  // モックデータ
  const user = {
    name: userId || "Unknown User",
    avatar: `https://via.placeholder.com/150/3B82F6/FFFFFF?Text=${userId ? userId.charAt(0).toUpperCase() : 'U'}`,
    onlineStatus: Math.random() > 0.5 ? "Online" : "Offline",
    rate: Math.floor(Math.random() * 30) + 1, // Avg rank for Pong42
    pong42History: [
      { date: "2024/05/01 10:00", rank: 5 },
      { date: "2024/05/03 14:30", rank: 2 },
      { date: "2024/05/05 20:15", rank: 10 },
    ],
    pong2History: [
      { date: "2024/05/02 11:00", result: "Win", opponent: "PlayerX" },
      { date: "2024/05/04 16:45", result: "Loss", opponent: "PlayerY" },
    ],
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-800 text-white p-6 font-['Futura']">
      <div className="w-full max-w-4xl bg-gray-700 shadow-2xl rounded-lg p-8">
        <div className="flex flex-col md:flex-row items-center md:items-start mb-8">
          <img
            src={user.avatar}
            alt={`${user.name}'s Avatar`}
            className="w-40 h-40 rounded-full border-4 border-indigo-500 mb-6 md:mb-0 md:mr-8"
          />
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold mb-2">{user.name}</h1>
            {(isOwnProfile || Math.random() > 0.3) && ( // 自分か友達の場合表示 (モック)
              <p className={`text-xl mb-1 ${user.onlineStatus === "Online" ? "text-green-400" : "text-gray-400"}`}>
                {user.onlineStatus}
              </p>
            )}
            <p className="text-xl text-gray-300 mb-4">Pong42 Average Rank: #{user.rate}</p>
            {!isOwnProfile && (
              <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition duration-150">
                Follow
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-indigo-400">Pong42 Rank History</h2>
            {/* モックのグラフエリア */}
            <div className="bg-gray-600 p-4 rounded-lg h-64 flex items-center justify-center">
              <p>Rank Graph Placeholder</p>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold mb-4 text-indigo-400">Pong2 Match History</h2>
            <ul className="space-y-3">
              {user.pong2History.map((match, index) => (
                <li key={index} className="bg-gray-600 p-3 rounded-md shadow">
                  <p className="font-medium">{match.date}</p>
                  <p>Result: <span className={match.result === "Win" ? "text-green-400" : "text-red-400"}>{match.result}</span> vs {match.opponent}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="text-center">
          <button
            onClick={() => navigate('MyPage')}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg text-xl transition duration-150"
          >
            Back to My Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
