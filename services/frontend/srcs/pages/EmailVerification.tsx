import React from 'react';
// import { Link } from 'react-router-dom'; // 削除

interface EmailVerificationProps {
  navigate: (page: string) => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ navigate }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4">
      <h1 className="text-4xl font-bold mb-8 font-['Futura']">Email Verification</h1>
      <div className="w-full max-w-xs">
        <input
          type="email"
          placeholder="Email"
          className="bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md w-full p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Futura']"
        />
        <input
          type="password"
          placeholder="Password"
          className="bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md w-full p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Futura']"
        />
        <button
          onClick={() => navigate('TwoFactorAuth')}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out block text-center font-['Futura']"
        >
          Verify
        </button>
      </div>
      <button onClick={() => navigate('Home')} className="mt-8 text-indigo-400 hover:text-indigo-300 font-['Futura']">
        Back to Home
      </button>
    </div>
  );
};

export default EmailVerification;
