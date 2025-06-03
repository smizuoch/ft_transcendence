import React from 'react';

interface GameResultProps {
  navigate: (page: string) => void;
}

const GameResult: React.FC<GameResultProps> = ({ navigate }) => {
  // GamePong42用のモックデータ - 生存者数に基づく順位
  const playerRank = Math.floor(Math.random() * 42) + 1;
  const isVictory = playerRank === 1; // 1位なら勝利

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen text-white p-4 font-['Futura'] relative"
      style={{
        backgroundImage: `url('/images/background/daybreak.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-40"></div>

      <div className="relative z-10 text-center">
        <h1 className="text-6xl font-bold mb-12">PONG 42 RESULT</h1>

        <div className="bg-black bg-opacity-70 p-8 rounded-lg shadow-xl text-center mb-12">
          <p className="text-3xl mb-4">
            {isVictory ? "VICTORY!" : "ELIMINATED"}
          </p>
          <p className="text-8xl font-bold text-yellow-400 mb-2">#{playerRank}</p>
          <p className="text-2xl">Final Rank</p>
          {isVictory && (
            <p className="text-lg text-green-400 mt-4">You are the last survivor!</p>
          )}
        </div>

        <button
          onClick={() => navigate('MyPage')}
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 px-8 rounded-lg text-2xl transition duration-150"
        >
          Back to My Page
        </button>
      </div>
    </div>
  );
};

export default GameResult;
