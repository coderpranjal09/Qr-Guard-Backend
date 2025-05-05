// AdminDashboard.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAddIcon, SearchIcon } from '@heroicons/react/outline';

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, Admin</h1>
        <p className="text-gray-600 text-lg">
          Manage vehicle entries and driver communications through the QRGuard system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => navigate('/add-user')}
          className="group p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow 
                   border border-gray-200 hover:border-blue-500 flex flex-col items-center
                   transform hover:-translate-y-1  duration-200"
        >
          <UserAddIcon className="w-12 h-12 text-blue-600 mb-4 group-hover:text-blue-700 transition-colors" />
          <span className="text-xl font-semibold text-gray-800 mb-2">Add User</span>
          <p className="text-gray-600 text-center text-sm">
            Register new vehicle owners and their driver details
          </p>
        </button>

        <button 
          onClick={() => navigate('/find-user')}
          className="group p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow 
                   border border-gray-200 hover:border-green-500 flex flex-col items-center
                   transform hover:-translate-y-1  duration-200"
        >
          <SearchIcon className="w-12 h-12 text-green-600 mb-4 group-hover:text-green-700 transition-colors" />
          <span className="text-xl font-semibold text-gray-800 mb-2">Find User</span>
          <p className="text-gray-600 text-center text-sm">
            Search and manage existing vehicle records
          </p>
        </button>
      </div>
    </div>
  );
}