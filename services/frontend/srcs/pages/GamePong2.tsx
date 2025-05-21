import React from 'react';
// import { Link } from 'react-router-dom'; // 削除

interface GamePong2Props {
  navigate: (page: string) => void;
}

const GamePong2: React.FC<GamePong2Props> = ({ navigate }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-['Futura']">
      <div className="absolute top-4 left-4 text-lg">Room: #12345</div>
      <button className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 px-4 py-2 rounded">
        Close Room & Start
      </button>
      
      <h1 className="text-6xl font-bold mb-8">PONG 2</h1>
      <div className="w-full max-w-4xl aspect-video bg-gray-900 border-4 border-blue-500 flex items-center justify-center mb-8">
        <p className="text-3xl">Game Area</p>
        {/* Mock game elements */}
        <div className="absolute left-10 top-1/2 transform -translate-y-1/2 w-4 h-24 bg-white"></div> {/* Player 1 Paddle */}
        <div className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-24 bg-white"></div> {/* Player 2 Paddle */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-yellow-400 rounded-full"></div> {/* Ball */}
      </div>

      <div className="flex justify-between w-full max-w-4xl text-2xl mb-8">
        <div>Player 1: 0</div>
        <div>Player 2: 0</div>
      </div>
      <div className="text-2xl mb-8">Survivors: 2</div>

      <button
        onClick={() => navigate('GameResult')}
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-xl transition duration-150"
      >
        End Game (To Result)
      </button>
      <button onClick={() => navigate('GameSelect')} className="mt-8 text-blue-400 hover:text-blue-300">
        Back to Game Select
      </button>
    </div>
  );
};

export default GamePong2;
