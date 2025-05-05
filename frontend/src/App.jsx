// App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AddUser from "./pages/AddUser";
import FindUser from "./pages/FindUser";
import AdminDashboard from "./pages/AdminDashboard";
import { ShieldCheckIcon, UserAddIcon, SearchIcon } from '@heroicons/react/outline';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <Link to="/" className="flex items-center space-x-3 mb-4 md:mb-0">
                <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-gray-900">QRGuard Admin</h1>
              </Link>
              <nav className="flex space-x-4">
                <Link
                  to="/add-user"
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <UserAddIcon className="w-5 h-5" />
                  <span>Add User</span>
                </Link>
                <Link
                  to="/find-user"
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <SearchIcon className="w-5 h-5" />
                  <span>Find User</span>
                </Link>
              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/add-user" element={<AddUser />} />
            <Route path="/find-user" element={<FindUser />} />
            <Route path="/" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;