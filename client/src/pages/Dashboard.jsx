import React, { useState, useEffect } from "react";
import "./Dashboard.css";
import ProductCatalogue from "./ProductCatalogue";
import MaterialsCatalogue from "./MaterialsCatalogue";
import Transactions from "./Transactions";
import Orders from "./Orders";
import Customers from "./Customers";
import Reports from "./Reports";
import Settings from "./Settings";
import Projects from "./Projects";
import Employees from "./Employees";
import Suppliers from "./Suppliers";
import { useNavigate, Link } from 'react-router-dom';
import CustomerRequests from "./CustomerRequests";
import SupplierDashboard from "./SupplierDashboard";
import SupplierRequests from "./SupplierRequests";
import WarehouseRequests from "./WarehouseRequests";

export default function Dashboard({ userRole, user: userProp, onLogout }) {
  const [user, setUser] = useState(userProp || null);
  const [activeTab, setActiveTab] = useState("overview");

  // Dashboard data state
  const [kpis, setKpis] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add state for suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsError, setSuggestionsError] = useState(null);

  useEffect(() => {
    if (userProp) setUser(userProp);
    else {
      const userData = JSON.parse(localStorage.getItem("user"));
      setUser(userData);
    }
  }, [userProp]);

  useEffect(() => {
    if (activeTab === "overview") {
      setLoading(true);
      Promise.all([
        fetch("http://localhost:5001/reports/kpis").then(res => res.json()),
        fetch("http://localhost:5001/reports/analytics").then(res => res.json()),
        fetch("http://localhost:5001/reports/transactions").then(res => res.json()),
      ]).then(([kpiData, analyticsData, transactionsData]) => {
        setKpis(kpiData);
        setAnalytics(analyticsData);
        setTransactions(transactionsData.sort((a, b) => new Date(b.date) - new Date(a.date)));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [activeTab]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/";
  };

  const navigate = useNavigate();

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await fetch("http://localhost:5001/requisitions/aggregate");
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      setSuggestions(data.suggestions || data); // support both formats
    } catch (err) {
      setSuggestionsError("Could not load suggestions.");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleSuggestionsClick = () => {
    if (!showSuggestions) {
      fetchSuggestions();
    }
    setShowSuggestions(v => !v);
  };

  // Role-based tab visibility
  const isAdmin = userRole === 'admin';
  const isStorekeeper = userRole === 'storekeeper';
  const isProjectManager = userRole === 'project_manager';
  const isEmployee = userRole === 'employee';
  const isCustomer = userRole === 'customer';
  const isManager = userRole === 'manager';
  const isTransporter = userRole === 'transporter';
  const isSupplier = userRole === 'supplier';

  if (!user) {
    return <div>Loading...</div>;
  }

  // --- CUSTOMER DASHBOARD ---
  if (isCustomer) {
    return (
      <div className="dashboard-container">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="logo-container">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1h-6z"/>
                </svg>
              </div>
              <h2 className="logo-text">StockFlow</h2>
            </div>
          </div>
          <nav className="sidebar-nav">
            <Link to="/customer-requests" className="nav-item-link">Customer Requests</Link>
            <button className="nav-item" onClick={() => setActiveTab("profile")}>Profile</button>
          </nav>
          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <div className="user-details">
                <span className="user-name">{user.username}</span>
                <span className="user-role">{user.role}</span>
              </div>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
        <div className="main-content">
          {activeTab === "profile" ? (
            <div style={{ padding: 32 }}>
              <h1>Customer Profile</h1>
              <p>Username: {user.username}</p>
              <p>Role: {user.role}</p>
              {/* Add more customer info here */}
            </div>
          ) : (
            <CustomerRequests />
          )}
        </div>
      </div>
    );
  }

  // --- SUPPLIER DASHBOARD ---
  if (isSupplier) {
    return (
      <div className="dashboard-container">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="logo-container">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1h-6z"/>
                </svg>
              </div>
              <h2 className="logo-text">StockFlow</h2>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button className="nav-item" onClick={() => setActiveTab("dashboard")}>Dashboard</button>
            <button className="nav-item" onClick={() => setActiveTab("profile")}>Profile</button>
          </nav>
          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <div className="user-details">
                <span className="user-name">{user.username}</span>
                <span className="user-role">{user.role}</span>
              </div>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              Logout
            </button>
          </div>
        </div>
        <div className="main-content">
          {activeTab === "profile" ? (
            <div style={{ padding: 32 }}>
              <h1>Supplier Profile</h1>
              <p>Username: {user.username}</p>
              <p>Role: {user.role}</p>
              {/* Add more supplier info here */}
            </div>
          ) : (
            <SupplierDashboard user={user} />
          )}
        </div>
      </div>
    );
  }

  // --- ADMIN, STOREKEEPER, PROJECT MANAGER, EMPLOYEE, MANAGER, TRANSPORTER DASHBOARDS ---
  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1h-6z"/>
              </svg>
            </div>
            <h2 className="logo-text">StockFlow</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
            </svg>
            Overview
          </button>
          {(isAdmin || isStorekeeper) && (
            <button 
              className={`nav-item ${activeTab === "product_catalogue" ? "active" : ""}`}
              onClick={() => setActiveTab("product_catalogue")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              Finished Products
            </button>
          )}
          {(isAdmin || isStorekeeper) && (
            <button 
              className={`nav-item ${activeTab === "materials_catalogue" ? "active" : ""}`}
              onClick={() => setActiveTab("materials_catalogue")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              Materials Catalogue
            </button>
          )}
          {(isAdmin || isStorekeeper) && (
            <button 
              className={`nav-item ${activeTab === "customers" ? "active" : ""}`}
              onClick={() => setActiveTab("customers")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01 1l-1.7 2.26V9H9V3H7v6H4.5C3.12 9 2 10.12 2 11.5V22h2v-2h12v2h2z"/>
              </svg>
              Customers
            </button>
          )}
          {(isAdmin || isStorekeeper) && (
            <button 
              className={`nav-item ${activeTab === "suppliers" ? "active" : ""}`}
              onClick={() => setActiveTab("suppliers")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 17c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm0-10c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
              Suppliers
            </button>
          )}
          {(isAdmin || isProjectManager) && (
            <button 
              className={`nav-item ${activeTab === "projects" ? "active" : ""}`}
              onClick={() => setActiveTab("projects")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
              Projects
            </button>
          )}
          {(isAdmin || isStorekeeper) && (
            <button 
              className={`nav-item ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              Orders
            </button>
          )}
          {(isAdmin || isStorekeeper) && (
            <button 
              className={`nav-item ${activeTab === "transactions" ? "active" : ""}`}
              onClick={() => setActiveTab("transactions")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Transactions
            </button>
          )}
          {(isAdmin || isStorekeeper || isProjectManager) && (
            <button 
              className={`nav-item ${activeTab === "reports" ? "active" : ""}`}
              onClick={() => setActiveTab("reports")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
              Reports
            </button>
          )}
          {isAdmin && (
            <button 
              className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
              Settings
            </button>
          )}
          {(isAdmin || isProjectManager) && (
            <button 
              className={`nav-item ${activeTab === "employees" ? "active" : ""}`}
              onClick={() => setActiveTab("employees")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05C15.64 13.37 17 14.28 17 15.5V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              Employees
            </button>
          )}
          {isCustomer && (
            <Link to="/customer-requests" className="nav-item-link">Customer Requests</Link>
          )}
          {isManager && (
            <Link to="/manager-requests" className="nav-item-link">Manager Requests</Link>
          )}
          {isTransporter && (
            <Link to="/transporter-requests" className="nav-item-link">Transporter Requests</Link>
          )}
          {(isAdmin || isProjectManager) && (
            <button 
              className={`nav-item ${activeTab === "supplier_requests" ? "active" : ""}`}
              onClick={() => setActiveTab("supplier_requests")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
              </svg>
              Supplier Requests
            </button>
          )}
          {(isAdmin || isProjectManager) && (
            <button 
              className={`nav-item ${activeTab === "warehouse_requests" ? "active" : ""}`}
              onClick={() => setActiveTab("warehouse_requests")}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Warehouse Requests
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user.username}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {activeTab === "overview" ? (
          <div>
            <div className="content-header">
              <h1 className="page-title">
                {activeTab === "overview" && "Dashboard Overview"}
                {activeTab === "settings" && "System Settings"}
              </h1>
              <div className="header-actions">
                <div className="date-display">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>

            <div className="content-body">
              {activeTab === "overview" && (
                loading ? (
                  <div className="content-placeholder"><h2>Loading dashboard...</h2></div>
                ) : (
                  <div className="overview-content">
                    {/* KPI Cards */}
                    <div className="kpi-grid">
                      <div className="kpi-card">
                        <div className="kpi-icon products-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{kpis ? kpis.totalProducts : '-'}</h3>
                          <p className="kpi-label">Total Products</p>
                          {/* No % change calculation for now */}
                        </div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-icon value-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{kpis ? `$${kpis.totalValue.toLocaleString()}` : '-'}</h3>
                          <p className="kpi-label">Stock Value</p>
                        </div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-icon low-stock-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{kpis ? kpis.lowStockItems : '-'}</h3>
                          <p className="kpi-label">Low Stock Items</p>
                        </div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-icon transactions-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{analytics ? analytics.transactionSummary.totalTransactions : '-'}</h3>
                          <p className="kpi-label">Total Transactions</p>
                        </div>
                      </div>
                    </div>

                    {/* Charts Section */}
                    <div className="charts-section">
                      <div className="chart-card">
                        <h3 className="chart-title">Stock Movement (Last 7 Days)</h3>
                        <div className="chart-placeholder">
                          {/* For now, show static bars. You can use analytics data for real charting. */}
                          <div className="chart-bars">
                            {/* TODO: Replace with real chart data if available */}
                            <div className="chart-bar" style={{height: '60%'}}></div>
                            <div className="chart-bar" style={{height: '80%'}}></div>
                            <div className="chart-bar" style={{height: '45%'}}></div>
                            <div className="chart-bar" style={{height: '90%'}}></div>
                            <div className="chart-bar" style={{height: '70%'}}></div>
                            <div className="chart-bar" style={{height: '85%'}}></div>
                            <div className="chart-bar" style={{height: '75%'}}></div>
                          </div>
                          <div className="chart-labels">
                            <span>Mon</span>
                            <span>Tue</span>
                            <span>Wed</span>
                            <span>Thu</span>
                            <span>Fri</span>
                            <span>Sat</span>
                            <span>Sun</span>
                          </div>
                        </div>
                      </div>

                      <div className="chart-card">
                        <h3 className="chart-title">Category Distribution</h3>
                        <div className="chart-placeholder">
                          <div className="pie-chart">
                            {/* Use analytics.categoryData for real data */}
                            {/* For now, show static pie. */}
                            <div className="pie-segment" style={{
                              transform: 'rotate(0deg)',
                              background: analytics && Object.keys(analytics.categoryData).length > 0
                                ? `conic-gradient(${Object.entries(analytics.categoryData).map(([cat, val], i, arr) => {
                                    const total = Object.values(analytics.categoryData).reduce((a, b) => a + b, 0);
                                    let start = 0;
                                    for (let j = 0; j < i; j++) {
                                      start += (Object.values(analytics.categoryData)[j] / total) * 360;
                                    }
                                    const end = start + (val / total) * 360;
                                    const colorArr = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#fcb69f'];
                                    return `${colorArr[i % colorArr.length]} ${start}deg ${end}deg`;
                                  }).join(', ')})`
                                : 'conic-gradient(from 0deg, #667eea 0deg 120deg, #764ba2 120deg 240deg, #f093fb 240deg 360deg)'
                            }}></div>
                          </div>
                          <div className="chart-legend">
                            {analytics && Object.entries(analytics.categoryData).map(([cat, val], i) => {
                              const total = Object.values(analytics.categoryData).reduce((a, b) => a + b, 0);
                              const percent = total ? Math.round((val / total) * 100) : 0;
                              const colorArr = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#fcb69f'];
                              return (
                                <div className="legend-item" key={cat}>
                                  <span className="legend-color" style={{background: colorArr[i % colorArr.length]}}></span>
                                  <span>{cat} ({percent}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="recent-activity">
                      <h3 className="section-title">Recent Activity</h3>
                      <div className="activity-list">
                        {transactions.slice(0, 5).map((t, idx) => {
                          // Normalize type for compatibility
                          const type = t.type === 'in' ? 'stock_in' : t.type === 'out' ? 'stock_out' : t.type;
                          return (
                            <div className="activity-item" key={t.id}>
                              <div className={`activity-icon ${type === 'stock_in' ? 'in' : type === 'stock_out' ? 'out' : 'alert'}`}>
                                {type === 'stock_in' ? (
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                  </svg>
                                ) : type === 'stock_out' ? (
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 13H5v-2h14v2z"/>
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                )}
                              </div>
                              <div className="activity-content">
                                <p className="activity-text">
                                  {type === 'stock_in' && `Stock in: ${t.quantity} units of "${t.product_name}" added`}
                                  {type === 'stock_out' && `Stock out: ${t.quantity} units of "${t.product_name}" sold`}
                                  {type === 'transfer' && `Transfer: ${t.quantity} units of "${t.product_name}"`}
                                </p>
                                <span className="activity-time">{new Date(t.date).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )
              )}

              {activeTab === "settings" && (
                <div className="settings-content">
                  <div className="content-placeholder">
                    <h2>System Settings</h2>
                    <p>User management, system configuration, and audit logs will be implemented here.</p>
                  </div>
                </div>
              )}

              {activeTab === "supplier_requests" && (
                <div className="supplier-requests-content">
                  <SupplierRequests user={user} />
                  </div>
                )}

              {activeTab === "warehouse_requests" && (
                <div className="warehouse-requests-content">
                  <WarehouseRequests user={user} />
              </div>
            )}
          </div>
            <div style={{ margin: '32px 0', display: 'flex', gap: 24 }}>
              <Link to="/customer-requests">Customer Requests</Link>
              <Link to="/manager-requests">Manager Requests</Link>
              <Link to="/transporter-requests">Transporter Requests</Link>
            </div>
          </div>
        ) : activeTab === "product_catalogue" ? (
          <div>
            <h2 style={{marginTop: 0, marginBottom: 16, color: '#1d3557'}}>Finished Products Catalogue</h2>
          <ProductCatalogue />
          </div>
        ) : activeTab === "materials_catalogue" ? (
          <div>
            <h2 style={{marginTop: 0, marginBottom: 16, color: '#1d3557'}}>Materials Catalogue</h2>
          <MaterialsCatalogue />
          </div>
        ) : activeTab === "customers" ? (
          <Customers />
        ) : activeTab === "suppliers" ? (
          <Suppliers />
        ) : activeTab === "projects" ? (
          <Projects />
        ) : activeTab === "orders" ? (
          <Orders />
        ) : activeTab === "transactions" ? (
          <Transactions />
        ) : activeTab === "reports" ? (
          <Reports />
        ) : activeTab === "settings" ? (
          <Settings />
        ) : activeTab === "employees" ? (
          <Employees />
        ) : (
          <>
            <div className="content-header">
              <h1 className="page-title">
                {activeTab === "overview" && "Dashboard Overview"}
                {activeTab === "settings" && "System Settings"}
              </h1>
              <div className="header-actions">
                <div className="date-display">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>

            <div className="content-body">
              {activeTab === "overview" && (
                loading ? (
                  <div className="content-placeholder"><h2>Loading dashboard...</h2></div>
                ) : (
                  <div className="overview-content">
                    {/* KPI Cards */}
                    <div className="kpi-grid">
                      <div className="kpi-card">
                        <div className="kpi-icon products-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{kpis ? kpis.totalProducts : '-'}</h3>
                          <p className="kpi-label">Total Products</p>
                          {/* No % change calculation for now */}
                        </div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-icon value-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{kpis ? `$${kpis.totalValue.toLocaleString()}` : '-'}</h3>
                          <p className="kpi-label">Stock Value</p>
                        </div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-icon low-stock-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{kpis ? kpis.lowStockItems : '-'}</h3>
                          <p className="kpi-label">Low Stock Items</p>
                        </div>
                      </div>

                      <div className="kpi-card">
                        <div className="kpi-icon transactions-icon">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                          </svg>
                        </div>
                        <div className="kpi-content">
                          <h3 className="kpi-value">{analytics ? analytics.transactionSummary.totalTransactions : '-'}</h3>
                          <p className="kpi-label">Total Transactions</p>
                        </div>
                      </div>
                    </div>

                    {/* Charts Section */}
                    <div className="charts-section">
                      <div className="chart-card">
                        <h3 className="chart-title">Stock Movement (Last 7 Days)</h3>
                        <div className="chart-placeholder">
                          {/* For now, show static bars. You can use analytics data for real charting. */}
                          <div className="chart-bars">
                            {/* TODO: Replace with real chart data if available */}
                            <div className="chart-bar" style={{height: '60%'}}></div>
                            <div className="chart-bar" style={{height: '80%'}}></div>
                            <div className="chart-bar" style={{height: '45%'}}></div>
                            <div className="chart-bar" style={{height: '90%'}}></div>
                            <div className="chart-bar" style={{height: '70%'}}></div>
                            <div className="chart-bar" style={{height: '85%'}}></div>
                            <div className="chart-bar" style={{height: '75%'}}></div>
                          </div>
                          <div className="chart-labels">
                            <span>Mon</span>
                            <span>Tue</span>
                            <span>Wed</span>
                            <span>Thu</span>
                            <span>Fri</span>
                            <span>Sat</span>
                            <span>Sun</span>
                          </div>
                        </div>
                      </div>

                      <div className="chart-card">
                        <h3 className="chart-title">Category Distribution</h3>
                        <div className="chart-placeholder">
                          <div className="pie-chart">
                            {/* Use analytics.categoryData for real data */}
                            {/* For now, show static pie. */}
                            <div className="pie-segment" style={{
                              transform: 'rotate(0deg)',
                              background: analytics && Object.keys(analytics.categoryData).length > 0
                                ? `conic-gradient(${Object.entries(analytics.categoryData).map(([cat, val], i, arr) => {
                                    const total = Object.values(analytics.categoryData).reduce((a, b) => a + b, 0);
                                    let start = 0;
                                    for (let j = 0; j < i; j++) {
                                      start += (Object.values(analytics.categoryData)[j] / total) * 360;
                                    }
                                    const end = start + (val / total) * 360;
                                    const colorArr = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#fcb69f'];
                                    return `${colorArr[i % colorArr.length]} ${start}deg ${end}deg`;
                                  }).join(', ')})`
                                : 'conic-gradient(from 0deg, #667eea 0deg 120deg, #764ba2 120deg 240deg, #f093fb 240deg 360deg)'
                            }}></div>
                          </div>
                          <div className="chart-legend">
                            {analytics && Object.entries(analytics.categoryData).map(([cat, val], i) => {
                              const total = Object.values(analytics.categoryData).reduce((a, b) => a + b, 0);
                              const percent = total ? Math.round((val / total) * 100) : 0;
                              const colorArr = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#fcb69f'];
                              return (
                                <div className="legend-item" key={cat}>
                                  <span className="legend-color" style={{background: colorArr[i % colorArr.length]}}></span>
                                  <span>{cat} ({percent}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="recent-activity">
                      <h3 className="section-title">Recent Activity</h3>
                      <div className="activity-list">
                        {transactions.slice(0, 5).map((t, idx) => {
                          // Normalize type for compatibility
                          const type = t.type === 'in' ? 'stock_in' : t.type === 'out' ? 'stock_out' : t.type;
                          return (
                            <div className="activity-item" key={t.id}>
                              <div className={`activity-icon ${type === 'stock_in' ? 'in' : type === 'stock_out' ? 'out' : 'alert'}`}>
                                {type === 'stock_in' ? (
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                  </svg>
                                ) : type === 'stock_out' ? (
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 13H5v-2h14v2z"/>
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                )}
                              </div>
                              <div className="activity-content">
                                <p className="activity-text">
                                  {type === 'stock_in' && `Stock in: ${t.quantity} units of "${t.product_name}" added`}
                                  {type === 'stock_out' && `Stock out: ${t.quantity} units of "${t.product_name}" sold`}
                                  {type === 'transfer' && `Transfer: ${t.quantity} units of "${t.product_name}"`}
                                </p>
                                <span className="activity-time">{new Date(t.date).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )
              )}

              {activeTab === "settings" && (
                <div className="settings-content">
                  <div className="content-placeholder">
                    <h2>System Settings</h2>
                    <p>User management, system configuration, and audit logs will be implemented here.</p>
                  </div>
                </div>
              )}

              {activeTab === "supplier_requests" && (
                <div className="supplier-requests-content">
                  <SupplierRequests user={user} />
                </div>
              )}

              {activeTab === "warehouse_requests" && (
                <div className="warehouse-requests-content">
                  <WarehouseRequests user={user} />
                </div>
              )}
            </div>
            <div style={{ margin: '32px 0', display: 'flex', gap: 24 }}>
              <Link to="/customer-requests">Customer Requests</Link>
              <Link to="/manager-requests">Manager Requests</Link>
              <Link to="/transporter-requests">Transporter Requests</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 