import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Welcome, Admin</h1>
      <p className="mb-4">This dashboard allows you to manage vehicle user entries and initiate driver calls via QRGuard.</p>
      <button onClick={() => navigate('/add-user')} className="bg-blue-500 text-white p-2 rounded m-2">Add User</button>
      <button onClick={() => navigate('/find-user')} className="bg-green-500 text-white p-2 rounded m-2">Find User</button>
    </div>
  );
}
