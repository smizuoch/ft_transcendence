import React from 'react';

interface GameSelectProps {
  navigate: (page: string) => void;
}

const GameSelect: React.FC<GameSelectProps> = ({ navigate }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4 font-['Futura']">
      <h1 className="text-5xl font-bold mb-12">Select Game Mode</h1>
      <div className="space-y-6 mb-12 w-full max-w-md">
        <input
          type="text"
          placeholder="Enter Room Number (optional)"
          className="bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-lg w-full p-4 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => navigate('GamePong2')}
          className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-lg text-2xl text-center transition duration-150"
        >
          PONG 2
        </button>
        <button
          onClick={() => navigate('GamePong42')}
          className="block w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 px-6 rounded-lg text-2xl text-center transition duration-150"
        >
          PONG 42
        </button>
      </div>
      <button onClick={() => navigate('MyPage')} className="text-indigo-400 hover:text-indigo-300 text-lg">
        Back to My Page
      </button>
    </div>
  );
};

export default GameSelect;
