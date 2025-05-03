import React, { useState } from 'react';

export default function CallNow() {
  const [vehicleId, setVehicleId] = useState('');

  const handleCall = async () => {
    const res = await fetch(`http://localhost:3000/api/initiate-call/${vehicleId}`);
    const data = await res.json();
    if (data.redirectNumber) {
      window.location.href = `tel:${data.redirectNumber}`; // Calls Twilio number
    } else {
      alert('Call initiation failed.');
    }
  };

  return (
    <div className="p-4">
      <input value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} placeholder="Enter Vehicle ID" className="border p-2 rounded" />
      <button onClick={handleCall} className="bg-blue-500 text-white p-2 rounded ml-2">Call Now</button>
    </div>
  );
}