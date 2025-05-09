import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckIcon, XIcon } from '@heroicons/react/solid';

function AddUser() {
  const [formData, setFormData] = useState({
    name: '',
    mobileNo: '',
    vehicleId: '',
    driverName: '',
    vehicleNo: '',
    model: '',
    email: '',
    driverNo: '+91',
    callLimit: 1
  });

  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleChange = (e) => {
    const value = e.target.name === 'callLimit' 
      ? Math.max(1, parseInt(e.target.value) || 1)
      : e.target.value;
    
    setFormData({ ...formData, [e.target.name]: value });
  };

  const incrementCallLimit = () => {
    setFormData(prev => ({
      ...prev,
      callLimit: prev.callLimit + 1
    }));
  };

  const decrementCallLimit = () => {
    if (formData.callLimit > 1) {
      setFormData(prev => ({
        ...prev,
        callLimit: prev.callLimit - 1
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await axios.post('https://qr-guard-backend.vercel.app/api/users', formData);
      setMessage('success');
      setFormData({
        name: '',
        mobileNo: '',
        vehicleId: '',
        driverName: '',
        vehicleNo: '',
        model: '',
        email: '',
        driverNo: '+91',
        callLimit: formData.callLimit
      });
    } catch (error) {
      setMessage('error');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldLabels = {
    name: 'Full Name',
    mobileNo: 'Mobile Number',
    vehicleId: 'Vehicle ID',
    driverName: 'Driver Name',
    vehicleNo: 'Vehicle Number',
    model: 'Vehicle Model',
    email: 'Email Address',
    driverNo: 'Driver Contact Number',
    callLimit: 'Daily Call Limit'
  };

  return (
    <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-2xl p-8 m-4">
      <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Add New User</h2>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
          message === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message === 'success' ? <CheckIcon className="w-6 h-6" /> : <XIcon className="w-6 h-6" />}
          <span className="font-medium">
            {message === 'success' ? 'User added successfully!' : 'Failed to add user.'}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(formData).map(([field, value]) => (
          <div key={field} className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {fieldLabels[field]}
            </label>
            {field === 'callLimit' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={decrementCallLimit}
                  disabled={formData.callLimit <= 1}
                  className="px-3 py-1.5 border rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  name={field}
                  value={value}
                  onChange={handleChange}
                  min="1"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg [-moz-appearance:textfield] [-webkit-appearance:none]"
                />
                <button
                  type="button"
                  onClick={incrementCallLimit}
                  className="px-3 py-1.5 border rounded-lg bg-gray-100 hover:bg-gray-200"
                >
                  +
                </button>
              </div>
            ) : (
              <input
                type="text"
                name={field}
                value={value}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder={field === 'driverNo' ? '+91XXXXXXXXXX' : ''}
              />
            )}
          </div>
        ))}
        
        <button
          type="submit"
          disabled={isLoading}
          className={`md:col-span-2 w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transform transition-all duration-200 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 hover:scale-105 hover:shadow-lg'
          }`}
        >
          {isLoading ? 'Adding...' : 'Add User'}
        </button>
      </form>
    </div>
  );
}

export default AddUser;