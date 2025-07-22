import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProductCatalogue from './pages/ProductCatalogue';
import MaterialsCatalogue from './pages/MaterialsCatalogue';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Employees from './pages/Employees';
import CustomerRequests from './pages/CustomerRequests';
import ManagerRequests from './pages/ManagerRequests';
import TransporterRequests from './pages/TransporterRequests';
import SupplierRequests from './pages/SupplierRequests';
import WarehouseRequests from './pages/WarehouseRequests';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [user, setUser] = useState(null);

  // Check for existing authentication on component mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      setIsAuthenticated(true);
      setUserRole(userData.role);
      setUser(userData);
    }
  }, []);

  const handleLogin = (userObj) => {
    setIsAuthenticated(true);
    setUserRole(userObj.role);
    setUser(userObj);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole('');
    setUser(null);
    localStorage.removeItem('user');
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="App">
        <Dashboard userRole={userRole} user={user} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard userRole={userRole} user={user} onLogout={handleLogout} />} />
            <Route path="/product-catalogue" element={<ProductCatalogue />} />
            <Route path="/materials-catalogue" element={<MaterialsCatalogue />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<ProjectDetails />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/customer-requests" element={<CustomerRequests />} />
            <Route path="/manager-requests" element={<ManagerRequests />} />
            <Route path="/transporter-requests" element={<TransporterRequests />} />
            <Route path="/supplier-requests" element={<SupplierRequests user={user} />} />
            <Route path="/warehouse-requests" element={<WarehouseRequests user={user} />} />
          </Routes>
        </Dashboard>
      </div>
    </Router>
  );
}

export default App;
