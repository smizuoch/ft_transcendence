import React from 'react';
import { Link } from 'react-router-dom';

const UserRegistration: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white p-4">
      <h1 className="text-4xl font-bold mb-8 font-['Futura']">User Registration</h1>
      <div className="w-full max-w-xs">
        <input
          type="text"
          placeholder="Username"
          className="bg-gray-700 text-white placeholder-gray-400 border border-gray-600 rounded-md w-full p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-['Futura']"
        />
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
        <Link
          to="/2fa"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out block text-center font-['Futura']"
        >
          Register
        </Link>
      </div>
      <Link to="/" className="mt-8 text-indigo-400 hover:text-indigo-300 font-['Futura']">
        Back to Home
      </Link>
    </div>
  );
};

export default UserRegistration;
