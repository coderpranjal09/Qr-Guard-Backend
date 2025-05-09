import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckIcon, XIcon, TrashIcon, SearchIcon } from '@heroicons/react/solid';

function FindUser() {
  const [vehicleId, setVehicleId] = useState('');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const res = await axios.get(`https://qr-guard-backend.vercel.app/api/users/${vehicleId}`);
      if (res.data.success && res.data.data) {
        setUser(res.data.data);
        setMessage('');
      } else {
        setUser(null);
        setMessage('not-found');
      }
    } catch (err) {
      setUser(null);
      setMessage(err.response?.status === 404 ? 'not-found' : 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await axios.delete(`https://qr-guard-backend.vercel.app/api/users/${vehicleId}`);
      setUser(null);
      setMessage('success');
      setVehicleId('');
    } catch (err) {
      setMessage('delete-error');
    } finally {
      setIsDeleting(false);
    }
  };

  const DetailItem = ({ label, value }) => (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium break-words">
        {value || (label.includes('Time') ? 'No alerts sent' : '-')}
      </dd>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-8 m-4">
      <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Find User</h2>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
          message === 'success' ? 'bg-green-100 text-green-700' : 
          message === 'delete-error' ? 'bg-red-100 text-red-700' :
          message === 'not-found' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
        }`}>
          {message === 'success' ? <CheckIcon className="w-6 h-6" /> : <XIcon className="w-6 h-6" />}
          <span className="font-medium">
            {message === 'success' ? 'User deleted successfully!' : 
             message === 'delete-error' ? 'Failed to delete user.' :
             message === 'not-found' ? 'User not found' : 'Error searching user'}
          </span>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <input
          type="text"
          placeholder="Enter Vehicle ID"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className={`bg-blue-600 text-white font-semibold px-6 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 ${
            isSearching ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 hover:scale-105'
          }`}
        >
          <SearchIcon className="w-5 h-5" />
          <span>{isSearching ? 'Searching...' : 'Search'}</span>
        </button>
      </div>

      {user && (
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <DetailItem label="Full Name" value={user.name} />
            <DetailItem label="Mobile Number" value={user.mobileNo} />
            <DetailItem label="Vehicle ID" value={user.vehicleId} />
            <DetailItem label="Driver Name" value={user.driverName} />
            <DetailItem label="Driver Contact" value={user.driverNo} />
            <DetailItem label="Vehicle Number" value={user.vehicleNo} />
            <DetailItem label="Vehicle Model" value={user.model} />
            <DetailItem label="Email Address" value={user.email} />
            <DetailItem label="Daily Call Limit" value={user.callLimit} />
            <DetailItem label="Calls Left Today" value={user.callsLeft} />
            <DetailItem 
              label="Last Alert Time" 
              value={user.lastCallTime ? 
                new Date(user.lastCallTime).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  dateStyle: 'short',
                  timeStyle: 'short'
                }) : 
                'No alerts sent'
              } 
            />
          </div>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`w-full bg-red-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center space-x-2 transition-all duration-200 ${
              isDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700 hover:scale-[1.02]'
            }`}
          >
            <TrashIcon className="w-5 h-5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete User'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default FindUser;