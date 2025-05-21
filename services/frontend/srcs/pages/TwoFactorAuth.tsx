import React from 'react';

interface TwoFactorAuthProps {
  navigate: (page: string) => void;
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ navigate }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4">
      <h1 className="text-4xl font-bold mb-8 font-['Futura']">Two-Factor Authentication</h1>
      <div className="w-full max-w-xs">
        <input
          type="text"
          placeholder="Enter 6-digit code"
          maxLength={6}
          className="bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md w-full p-3 mb-4 text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Futura']"
        />
        <button
          onClick={() => navigate('MyPage')}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out block text-center mb-4 font-['Futura']"
        >
          Verify Code
        </button>
        <button
          type="button"
          className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-150 ease-in-out font-['Futura']"
        >
          Resend Code
        </button>
      </div>
      <button onClick={() => navigate('Home')} className="mt-8 text-indigo-400 hover:text-indigo-300 font-['Futura']">
        Back to Home
      </button>
    </div>
  );
};

export default TwoFactorAuth;
