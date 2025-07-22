import React, { useState, useEffect } from "react";
import "./Settings.css";
import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import { useRef } from "react";

export default function Settings() {
  const [users, setUsers] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [skills, setSkills] = useState([]);
  const [editingSkill, setEditingSkill] = useState(null);
  const [showSkillModal, setShowSkillModal] = useState(false);

  // Fetch users from backend
  const fetchUsers = () => {
    fetch("http://localhost:5001/users")
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(() => setUsers([]));
  };

  // Fetch audit logs from backend
  const fetchAuditLogs = () => {
    fetch("http://localhost:5001/audit-logs")
      .then(res => res.json())
      .then(data => setAuditLogs(data))
      .catch(() => setAuditLogs([]));
  };

  const fetchWarehouses = () => {
    fetch("http://localhost:5001/warehouses")
      .then(res => res.json())
      .then(data => setWarehouses(data))
      .catch(() => setWarehouses([]));
  };

  const fetchSkills = () => {
    fetch("http://localhost:5001/skills")
      .then(res => res.json())
      .then(data => setSkills(data))
      .catch(() => setSkills([]));
  };

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
    fetchWarehouses();
    fetchSkills();
  }, []);

  const handleAddUser = (userData) => {
    fetch("http://localhost:5001/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to add user");
        return res.json();
      })
      .then(() => {
        fetchUsers();
        setShowAddForm(false);
      })
      .catch(() => alert("Failed to add user. Username may already exist."));
  };

  const handleEditUser = (userData) => {
    fetch(`http://localhost:5001/users/${editingUser.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update user");
        return res.json();
      })
      .then(() => {
        fetchUsers();
        setEditingUser(null);
      })
      .catch(() => alert("Failed to update user."));
  };

  const handleDeleteUser = (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      fetch(`http://localhost:5001/users/${id}`, {
        method: "DELETE"
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to delete user");
          return res.json();
        })
        .then(() => fetchUsers())
        .catch(() => alert("Failed to delete user."));
    }
  };

  const handleWarehouseLocationUpdate = (id, locationData) => {
    fetch(`http://localhost:5001/warehouses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(locationData)
    })
      .then(res => res.json())
      .then(() => {
        fetchWarehouses();
        setShowWarehouseModal(false);
        setEditingWarehouse(null);
      })
      .catch(() => alert("Failed to update warehouse location."));
  };

  const handleAddSkill = (skillData) => {
    fetch("http://localhost:5001/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skillData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to add skill");
        return res.json();
      })
      .then(() => {
        fetchSkills();
        setShowSkillModal(false);
      })
      .catch(() => alert("Failed to add skill. Skill name may already exist."));
  };

  const handleEditSkill = (skillData) => {
    fetch(`http://localhost:5001/skills/${editingSkill.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skillData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update skill");
        return res.json();
      })
      .then(() => {
        fetchSkills();
        setEditingSkill(null);
        setShowSkillModal(false);
      })
      .catch(() => alert("Failed to update skill."));
  };

  const handleDeleteSkill = (id) => {
    if (window.confirm("Are you sure you want to delete this skill?")) {
      fetch(`http://localhost:5001/skills/${id}`, {
        method: "DELETE"
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to delete skill");
          return res.json();
        })
        .then(() => fetchSkills())
        .catch(() => alert("Failed to delete skill."));
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="page-title">System Settings</h1>
        <p className="page-subtitle">Manage users, roles, and view audit logs</p>
        <button className="add-user-btn" onClick={() => setShowAddForm(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Last Login</th>
              <th>Login IP</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="user-row">
                <td className="user-username">{user.username}</td>
                <td className="user-role">{user.role}</td>
                <td className="user-last-login">{user.last_login ? new Date(user.last_login).toLocaleString() : "-"}</td>
                <td className="user-login-ip">{user.login_ip || "-"}</td>
                <td className="user-actions">
                  <button className="action-btn edit" onClick={() => setEditingUser(user)}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                  </button>
                  <button className="action-btn delete" onClick={() => handleDeleteUser(user.id)}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit User Modal */}
      {(showAddForm || editingUser) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button className="close-btn" onClick={() => { setShowAddForm(false); setEditingUser(null); }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <UserForm
              user={editingUser}
              onSubmit={editingUser ? handleEditUser : handleAddUser}
              onCancel={() => { setShowAddForm(false); setEditingUser(null); }}
            />
          </div>
        </div>
      )}

      {/* Audit Logs */}
      <div className="audit-logs-section">
        <h2>Audit Logs</h2>
        <div className="audit-logs-table-container">
          <table className="audit-logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Product</th>
                <th>Field Changed</th>
                <th>Old Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(log => (
                <tr key={log.id}>
                  <td>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}</td>
                  <td>{log.user_username || "-"}</td>
                  <td>{log.product_name || "-"}</td>
                  <td>{log.field_changed}</td>
                  <td>{log.old_value}</td>
                  <td>{log.new_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warehouses Section */}
      <div className="warehouses-section">
        <h2>Warehouses</h2>
        <div className="warehouses-table-container">
          <table className="warehouses-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map(wh => (
                <tr key={wh.id}>
                  <td>{wh.name}</td>
                  <td>{wh.location || '-'}</td>
                  <td>{wh.lat || '-'}</td>
                  <td>{wh.lng || '-'}</td>
                  <td>
                    <button className="action-btn edit" onClick={() => { setEditingWarehouse(wh); setShowWarehouseModal(true); }}>
                      Edit Location
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showWarehouseModal && editingWarehouse && (
        <WarehouseLocationModal
          warehouse={editingWarehouse}
          onSubmit={(loc) => handleWarehouseLocationUpdate(editingWarehouse.id, loc)}
          onCancel={() => { setShowWarehouseModal(false); setEditingWarehouse(null); }}
        />
      )}

      {/* Skills Section */}
      <div className="skills-section">
        <div className="section-header">
          <h2>Skills Management</h2>
          <button className="add-skill-btn" onClick={() => setShowSkillModal(true)}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add Skill
          </button>
        </div>
        <div className="skills-table-container">
          <table className="skills-table">
            <thead>
              <tr>
                <th>Skill Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {skills.map(skill => (
                <tr key={skill.id}>
                  <td>{skill.name}</td>
                  <td>
                    <button className="action-btn edit" onClick={() => { setEditingSkill(skill); setShowSkillModal(true); }}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    <button className="action-btn delete" onClick={() => handleDeleteSkill(skill.id)}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Skill Modal */}
      {showSkillModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingSkill ? 'Edit Skill' : 'Add New Skill'}</h2>
              <button className="close-btn" onClick={() => { setShowSkillModal(false); setEditingSkill(null); }}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <SkillForm
              skill={editingSkill}
              onSubmit={editingSkill ? handleEditSkill : handleAddSkill}
              onCancel={() => { setShowSkillModal(false); setEditingSkill(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Skill Form Component
function SkillForm({ skill, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: skill?.name || ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="skill-form">
      <div className="form-group">
        <label>Skill Name *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Enter skill name"
        />
      </div>
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="save-btn">
          {skill ? 'Update Skill' : 'Add Skill'}
        </button>
      </div>
    </form>
  );
}

// User Form Component
function UserForm({ user, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    username: user?.username || "",
    password: "",
    role: user?.role || "storekeeper"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="user-form">
      <div className="form-grid">
        <div className="form-group">
          <label>Username *</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            placeholder="Enter username"
            disabled={!!user}
          />
        </div>
        <div className="form-group">
          <label>Password {user ? '(Leave blank to keep unchanged)' : '*'}</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder={user ? "Leave blank to keep current password" : "Enter password"}
            required={!user}
          />
        </div>
        <div className="form-group">
          <label>Role *</label>
          <select name="role" value={formData.role} onChange={handleChange} required>
            <option value="admin">Admin</option>
            <option value="storekeeper">Storekeeper</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="save-btn">
          {user ? 'Update User' : 'Add User'}
        </button>
      </div>
    </form>
  );
}

function WarehouseLocationModal({ warehouse, onSubmit, onCancel }) {
  const [location, setLocation] = useState({
    lng: warehouse?.lng || null,
    lat: warehouse?.lat || null,
    address: warehouse?.location || ''
  });
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (!mapboxToken || !mapContainer.current) return;
    if (mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [location.lng || 77.209, location.lat || 28.6139],
      zoom: location.lng && location.lat ? 12 : 4
    });
    mapRef.current = map;
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: "Search warehouse location..."
    });
    map.addControl(geocoder);
    geocoder.on("result", (e) => {
      const { center, place_name } = e.result;
      setLocation({ lng: center[0], lat: center[1], address: place_name });
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.flyTo({ center, zoom: 12 });
    });
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setLocation((loc) => ({ ...loc, lng, lat }));
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`
      )
        .then((res) => res.json())
        .then((data) => {
          const place = data.features[0]?.place_name || "";
          setLocation((loc) => ({ ...loc, address: place }));
        });
    });
    if (location.lng && location.lat) {
      const center = [location.lng, location.lat];
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.setCenter(center);
      map.setZoom(12);
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ location: location.address, lat: location.lat, lng: location.lng });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Warehouse Location</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div ref={mapContainer} style={{ width: "100%", height: 300, borderRadius: 8, marginBottom: 8 }} />
            {location.address && (
              <div style={{ marginTop: 8, fontSize: 14, color: "#333" }}>
                <b>Selected Address:</b> {location.address}
              </div>
            )}
            {(location.lat !== null && location.lng !== null) && (
              <div style={{ marginTop: 4, fontSize: 13, color: '#555' }}>
                <b>Latitude:</b> {location.lat} <b>Longitude:</b> {location.lng}
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={location.lat === null || location.lng === null}>
              Save Location
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 