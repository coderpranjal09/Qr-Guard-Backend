import React, { useState } from 'react';
import axios from 'axios';

function AddUser() {
  const [formData, setFormData] = useState({
    name: '',
    mobileNo: '',
    vehicleId: '',
    driverName: '',
    vehicleNo: '',
    model: '',
    email: '',
    driverNo: '',
  });

  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/users', formData);
      setMessage('✅ User added successfully!');
    } catch (error) {
      setMessage('❌ Failed to add user.');
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white shadow-lg p-6 rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-blue-700">Add User</h2>
      {message && <p className="mb-4 text-center">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        {Object.entries(formData).map(([field, value]) => (
          <div key={field}>
            <label className="block font-medium">{field}</label>
            <input
              type="text"
              name={field}
              value={value}
              onChange={handleChange}
              required
              className="w-full border border-gray-300 p-2 rounded"
            />
          </div>
        ))}
        <button
          type="submit"
          className="w-full mt-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

export default AddUser;
