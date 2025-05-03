import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AddUser from "./pages/AddUser";
import FindUser from "./pages/FindUser";

import './App.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold text-blue-600">QRGuard Admin Dashboard</h1>
          <p className="text-lg mt-2 text-gray-600">Welcome, Admin. Use the panel to manage vehicle users and initiate safety calls.</p>
        </header>

        <nav className="flex justify-center space-x-4 mb-10">
          <Link to="/add" className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Add User</Link>
          <Link to="/find" className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600">Find User</Link>
        </nav>

        <Routes>
          <Route path="/add" element={<AddUser />} />
          <Route path="/find" element={<FindUser />} />
          <Route
            path="/"
            element={
              <div className="text-center text-lg">
                <p>This admin panel helps you:</p>
                <ul className="mt-4 list-disc list-inside text-left mx-auto max-w-xl">
                  <li>Add vehicle and driver details to the database.</li>
                  <li>Search and manage existing vehicle records.</li>
                  <li>Initiate secure, masked calls to drivers when QR is scanned.</li>
                </ul>
              </div>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
