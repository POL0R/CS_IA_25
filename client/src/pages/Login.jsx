import React, { useState } from "react";
import bcrypt from "bcryptjs";
import "./Login.css";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("customer");
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("http://localhost:5001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success) {
        // Fetch user profile to get email
        let userEmail = null;
        try {
          const userProfileRes = await fetch(`http://localhost:5001/users?username=${encodeURIComponent(data.username)}`);
          if (userProfileRes.ok) {
            const userProfile = await userProfileRes.json();
            if (userProfile && userProfile.email) userEmail = userProfile.email;
          }
        } catch (e) {}
        const userObj = { username: data.username, role: data.role, user_id: data.user_id, email: userEmail };
        localStorage.setItem("user", JSON.stringify(userObj));
        if (onLogin) onLogin(userObj);
      } else {
        setError(data.error || "Invalid username or password");
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");
    try {
      const res = await fetch("http://localhost:5001/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          role: regRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Automatically log in after successful registration
        try {
          const loginRes = await fetch("http://localhost:5001/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username: regUsername, password: regPassword })
          });
          const loginData = await loginRes.json();
          if (loginData.success) {
            // Fetch user profile to get email
            const userProfileRes = await fetch(`http://localhost:5001/users?username=${encodeURIComponent(regUsername)}`);
            let userEmail = regEmail;
            if (userProfileRes.ok) {
              const userProfile = await userProfileRes.json();
              if (userProfile && userProfile.email) userEmail = userProfile.email;
            }
            const userObj = { username: loginData.username, role: loginData.role, user_id: loginData.user_id, email: userEmail };
            localStorage.setItem("user", JSON.stringify(userObj));
            if (onLogin) onLogin(userObj);
          } else {
            setRegSuccess("Registration successful, but automatic login failed. Please log in manually.");
          }
        } catch (loginErr) {
          setRegSuccess("Registration successful, but automatic login failed. Please log in manually.");
        }
        setRegUsername("");
        setRegEmail("");
        setRegPassword("");
        setRegRole("customer");
      } else {
        setRegError(data.error || "Registration failed");
      }
    } catch (err) {
      setRegError("Server error. Please try again later.");
    }
  };

  return (
    <div className="login-container">
      {/* Animated background */}
      <div className="background-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
        <div className="floating-shape shape-4"></div>
      </div>

      {/* Main content */}
      <div className="login-content">
        <div className="login-card">
          {/* Header */}
          <div className="login-header">
            <div className="logo-container">
              <div className="logo-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1h-6z"/>
                </svg>
              </div>
              <div className="logo-glow"></div>
            </div>
            <h1 className="login-title">StockFlow</h1>
            <p className="login-subtitle">Advanced Inventory Management</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <button
              className={`toggle-tab${!showRegister ? ' active' : ''}`}
              onClick={() => setShowRegister(false)}
              style={{ marginRight: 8 }}
            >
              Sign In
            </button>
            <button
              className={`toggle-tab${showRegister ? ' active' : ''}`}
              onClick={() => setShowRegister(true)}
            >
              Register
            </button>
          </div>

          {!showRegister ? (
            <form onSubmit={handleLogin} className="login-form">
              {error && (
                <div className="error-message">
                  <span className="error-icon">⚠</span>
                  {error}
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Username</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="login-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                  />
                  <div className="input-focus-border"></div>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-wrapper">
                  <input
                    type="password"
                    className="login-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <div className="input-focus-border"></div>
                </div>
              </div>
              <button type="submit" className="login-button">
                <span className="button-text">Sign In</span>
                <div className="button-glow"></div>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="login-form">
              {regError && (
                <div className="error-message">
                  <span className="error-icon">⚠</span>
                  {regError}
                </div>
              )}
              {regSuccess && (
                <div className="success-message">
                  <span className="success-icon">✔</span>
                  {regSuccess}
                </div>
              )}
              <div className="input-group">
                <label className="input-label">Username</label>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="login-input"
                    placeholder="Choose a username"
                    value={regUsername}
                    onChange={e => setRegUsername(e.target.value)}
                    required
                  />
                  <div className="input-focus-border"></div>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    className="login-input"
                    placeholder="Enter your email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    required
                  />
                  <div className="input-focus-border"></div>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-wrapper">
                  <input
                    type="password"
                    className="login-input"
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    required
                  />
                  <div className="input-focus-border"></div>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Register as</label>
                <div className="input-wrapper">
                  <select
                    className="login-input"
                    value={regRole}
                    onChange={e => setRegRole(e.target.value)}
                    required
                  >
                    <option value="customer">Customer</option>
                    <option value="supplier">Supplier</option>
                  </select>
                  <div className="input-focus-border"></div>
                </div>
              </div>
              <button type="submit" className="login-button">
                <span className="button-text">Register</span>
                <div className="button-glow"></div>
              </button>
            </form>
          )}

          {/* Demo credentials */}
          <div className="demo-credentials">
            <h3 className="demo-title">Demo Access</h3>
            <div className="credential-item">
              <span className="credential-label">Admin:</span>
              <span className="credential-value">admin / admin123</span>
            </div>
            <div className="credential-item">
              <span className="credential-label">Store:</span>
              <span className="credential-value">store1 / storepass</span>
            </div>
            <div className="credential-item">
              <span className="credential-label">Customer:</span>
              <span className="credential-value">customer1 / custpass</span>
            </div>
            <div className="credential-item">
              <span className="credential-label">Supplier:</span>
              <span className="credential-value">supplier1 / supppass</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>© 2024 IB HL Computer Science IA | Stock Management System</p>
        </div>
      </div>
    </div>
  );
} 