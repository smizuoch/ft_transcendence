import React from 'react';

interface GamePong42Props {
  navigate: (page: string) => void;
}

const GamePong42: React.FC<GamePong42Props> = ({ navigate }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 font-['Futura']">
      <h1 className="text-6xl font-bold mb-8">PONG 42</h1>
      
      <div className="w-full max-w-5xl aspect-[16/10] bg-gray-900 border-4 border-purple-500 flex flex-col items-center justify-center mb-8 relative">
        <p className="text-3xl mb-4">Main Game Area</p>
        {/* Mock game elements */}
        <div className="absolute left-1/2 bottom-5 w-24 h-4 bg-white"></div> {/* Player Paddle */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-yellow-400 rounded-full"></div> {/* Ball */}

        <div className="absolute top-2 right-2 text-xl">Survivors: 42</div>
        
        <div className="absolute bottom-2 left-2 grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }).map((_, i) => ( // Mock opponent screens
            <div key={i} className="w-16 h-10 bg-gray-700 border border-gray-600 text-xs flex items-center justify-center hover:bg-red-500 cursor-pointer">
              P{i+1}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => navigate('GameResult')}
        className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg text-xl transition duration-150"
      >
        End Game (To Result)
      </button>
      <button onClick={() => navigate('GameSelect')} className="mt-8 text-purple-400 hover:text-purple-300">
        Back to Game Select
      </button>
    </div>
  );
};

export default GamePong42;
