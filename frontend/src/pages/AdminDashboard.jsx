import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserAddIcon, SearchIcon, RefreshIcon } from '@heroicons/react/outline';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleResetCallLimits = async () => {
    try {
      const response = await fetch('/api/manual-reset', {
        method: 'POST'
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset call limits');
      }

      if (data.success) {
        alert(`Successfully reset call limits for ${data.message.match(/\d+/)?.[0] || 'all'} users!`);
      } else {
        alert('Reset failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('Error: ' + error.message);
    } finally {
      setShowConfirmation(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Confirm Reset</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to reset call limits for all users?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetCallLimits}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600 text-lg">
          Manage vehicle entries and driver communications
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add User Button */}
        <button 
          onClick={() => navigate('/add-user')}
          className="group p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow 
                   border border-gray-200 hover:border-blue-500 flex flex-col items-center
                   transform hover:-translate-y-1 duration-200"
        >
          <UserAddIcon className="w-12 h-12 text-blue-600 mb-4 group-hover:text-blue-700 transition-colors" />
          <span className="text-xl font-semibold text-gray-800 mb-2">Add User</span>
          <p className="text-gray-600 text-center text-sm">
            Register new vehicle owners and drivers
          </p>
        </button>

        {/* Find User Button */}
        <button 
          onClick={() => navigate('/find-user')}
          className="group p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow 
                   border border-gray-200 hover:border-green-500 flex flex-col items-center
                   transform hover:-translate-y-1 duration-200"
        >
          <SearchIcon className="w-12 h-12 text-green-600 mb-4 group-hover:text-green-700 transition-colors" />
          <span className="text-xl font-semibold text-gray-800 mb-2">Find User</span>
          <p className="text-gray-600 text-center text-sm">
            Search and manage existing records
          </p>
        </button>

        {/* Reset Call Limits Button */}
        <div className="col-span-full mt-8">
          <button 
            onClick={() => setShowConfirmation(true)}
            className="w-full group p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow 
                     border border-gray-200 hover:border-red-500 flex flex-col items-center
                     transform hover:-translate-y-1 duration-200"
          >
            <RefreshIcon className="w-12 h-12 text-red-600 mb-4 group-hover:text-red-700 transition-colors" />
            <span className="text-xl font-semibold text-gray-800 mb-2">Reset All Call Limits</span>
            <p className="text-gray-600 text-center text-sm">
              Refresh available calls for all users
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}