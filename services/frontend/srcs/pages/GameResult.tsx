import React from 'react';

interface GameResultProps {
  navigate: (page: string) => void;
}

const GameResult: React.FC<GameResultProps> = ({ navigate }) => {
  // モックデータ
  const playerRank = Math.floor(Math.random() * 42) + 1; 

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4 font-['Futura']">
      <h1 className="text-6xl font-bold mb-12">Game Result</h1>
      
      <div className="bg-gray-700 p-8 rounded-lg shadow-xl text-center mb-12">
        <p className="text-3xl mb-4">Congratulations!</p>
        <p className="text-8xl font-bold text-yellow-400 mb-2">#{playerRank}</p>
        <p className="text-2xl">Your Rank</p>
      </div>

      <button
        onClick={() => navigate('MyPage')}
        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 px-8 rounded-lg text-2xl transition duration-150"
      >
        Back to My Page
      </button>
    </div>
  );
};

export default GameResult;
