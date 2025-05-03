import React, { useState } from 'react';
import axios from 'axios';

function FindUser() {
  const [vehicleId, setVehicleId] = useState('');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');

  const handleSearch = async () => {
    try {
      const res = await axios.get(`https://qr-guard-backend.vercel.app/api/users/${vehicleId}`);
      setUser(res.data);
      setMessage('');
    } catch (err) {
      setUser(null);
      setMessage('❌ User not found.');
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`https://qr-guard-backend.vercel.app/api/users/${vehicleId}`);
      setUser(null);
      setMessage('✅ User deleted.');
    } catch (err) {
      setMessage('❌ Failed to delete user.');
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white shadow-lg p-6 rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-green-700">Find User</h2>
      <div className="mb-4 flex space-x-3">
        <input
          type="text"
          placeholder="Enter Vehicle ID"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="flex-1 border border-gray-300 p-2 rounded"
        />
        <button
          onClick={handleSearch}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Search
        </button>
      </div>

      {message && <p className="mb-2">{message}</p>}

      {user && (
        <div className="bg-gray-50 p-4 rounded border">
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Mobile No:</strong> {user.mobile}</p>
          <p><strong>Vehicle ID:</strong> {user.vehicleId}</p>
          <p><strong>Driver Name:</strong> {user.driverName}</p>
          <p><strong>Driver No:</strong> {user.driverNo}</p>
          <p><strong>Vehicle No:</strong> {user.vehicleNo}</p>
          <p><strong>Model:</strong> {user.model}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <button
            onClick={handleDelete}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Delete User
          </button>
        </div>
      )}
    </div>
  );
}

export default FindUser;
