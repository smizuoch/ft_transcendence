import React from 'react';
// import { Link } from 'react-router-dom'; // 削除

interface MyPageProps {
  navigate: (page: string, params?: Record<string, string>) => void;
}

const MyPage: React.FC<MyPageProps> = ({ navigate }) => {
  const username = "MyUsername"; // モックデータ

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4 font-['Futura']">
      <h1 className="text-5xl font-bold mb-12">My Page</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mb-12">
        <div className="flex flex-col items-center">
          <img
            src={`https://via.placeholder.com/150/771796/FFFFFF?Text=${username}`} // モックアバター
            alt="User Avatar"
            className="w-32 h-32 rounded-full mb-4 border-4 border-indigo-500"
          />
          <button 
            onClick={() => navigate('UserProfile', { userId: username.toLowerCase() })} 
            className="text-2xl font-semibold text-indigo-400 hover:text-indigo-300 mb-2"
          >
            {username}
          </button>
          <button className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md">
            Upload Avatar
          </button>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <button
            onClick={() => navigate('GameSelect')}
            className="w-full max-w-xs bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-xl text-center transition duration-150"
          >
            Play Game
          </button>
          <input
            type="text"
            placeholder="Search User..."
            className="w-full max-w-xs bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {/* モックの検索結果へのリンク */}
          <button
            onClick={() => navigate('UserProfile', { userId: 'searcheduser' })}
            className="w-full max-w-xs bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-xl text-center transition duration-150"
          >
            Go to Searched Profile
          </button>
          <a
            href="http://localhost:5601" // KibanaのURL（仮）
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 px-6 rounded-lg text-xl text-center transition duration-150"
          >
            DevOps (Kibana)
          </a>
        </div>
      </div>

      <button onClick={() => navigate('Home')} className="text-indigo-400 hover:text-indigo-300">
        Logout (Back to Home)
      </button>
    </div>
  );
};

export default MyPage;
