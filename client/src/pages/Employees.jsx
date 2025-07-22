import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select/creatable';
import './ProjectsIcons.css';
import './Projects.css';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    username: '', email: '', password: '',
    first_name: '', last_name: '', phone: '',
    skills: [], hourly_rate: '', location: '', role: 'employee'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [allSkills, setAllSkills] = useState([]); // [{label, value}]
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchEmployees(); fetchSkills(); }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/employees');
      const data = await res.json();
      setEmployees(data);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSkills = async () => {
    try {
      const res = await fetch('http://localhost:5001/skills');
      const data = await res.json();
      setAllSkills(data.map(s => ({ label: s.name, value: s.id })));
    } catch {
      setAllSkills([]);
    }
  };

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSkillsChange = (selected) => {
    setForm({ ...form, skills: selected || [] });
  };

  const handleCreateSkill = (inputValue) => {
    fetch('http://localhost:5001/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: inputValue })
    })
      .then(res => res.json())
      .then(newSkill => {
        const skillOption = { label: newSkill.name, value: newSkill.id };
        setAllSkills(prev => [...prev, skillOption]);
        setForm(f => ({ ...f, skills: [...(f.skills || []), skillOption] }));
      });
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setSaving(true);
    try {
      // 1. Create user
      const userRes = await fetch('http://localhost:5001/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role
        })
      });
      const userData = await userRes.json();
      if (!userRes.ok || !userData.id) throw new Error(userData.error || 'User creation failed');
      // 2. Create employee profile
      const empRes = await fetch('http://localhost:5001/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.id,
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          skills: JSON.stringify((form.skills || []).map(s => s.label)),
          hourly_rate: parseFloat(form.hourly_rate),
          location: form.location
        })
      });
      const empData = await empRes.json();
      if (!empRes.ok) throw new Error(empData.error || 'Employee creation failed');
      setSuccess('Employee added successfully!');
      setShowModal(false);
      setForm({ username: '', email: '', password: '', first_name: '', last_name: '', phone: '', skills: [], hourly_rate: '', location: '', role: 'employee' });
      fetchEmployees();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="projects-wrapper">
      <div className="projects-container">
        <div className="projects-header">
          <h1 className="projects-title">Employees</h1>
          <button className="project-card-btn" onClick={() => setShowModal(true)}>
            Add Employee
          </button>
        </div>
        {loading ? <div>Loading...</div> : (
          <div className="projects-grid">
            {employees.map(emp => (
              <div key={emp.id} className="project-card">
                <div className="project-card-header">
                  <h3 className="project-card-title">{emp.first_name} {emp.last_name}</h3>
                  <span className="badge badge-status-active">{emp.is_available ? 'Available' : 'Unavailable'}</span>
                </div>
                <div className="project-card-info">
                  <div className="project-card-info-row"><b>Email:</b> {emp.email}</div>
                  <div className="project-card-info-row"><b>Phone:</b> {emp.phone}</div>
                  <div className="project-card-info-row"><b>Location:</b> {emp.location}</div>
                  <div className="project-card-info-row"><b>Hourly Rate:</b> ${emp.hourly_rate}</div>
                  <div className="project-card-info-row"><b>Skills:</b> {(() => { try { return JSON.parse(emp.skills).join(', '); } catch { return emp.skills; } })()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {showModal && (
          <div className="projects-modal-overlay">
            <div className="projects-modal">
              <h2 className="projects-modal-title">Add Employee</h2>
              <form className="projects-form" onSubmit={handleAddEmployee}>
                <div style={{display:'flex',gap:12}}>
                  <div style={{flex:1}}><label>Username</label><input name="username" value={form.username} onChange={handleChange} required /></div>
                  <div style={{flex:1}}><label>Email</label><input name="email" value={form.email} onChange={handleChange} required type="email" /></div>
                </div>
                <div style={{display:'flex',gap:12}}>
                  <div style={{flex:1}}><label>Password</label><input name="password" value={form.password} onChange={handleChange} required type="password" /></div>
                  <div style={{flex:1}}><label>Role</label><select name="role" value={form.role} onChange={handleChange}><option value="employee">Employee</option><option value="project_manager">Project Manager</option><option value="admin">Admin</option></select></div>
                </div>
                <div style={{display:'flex',gap:12}}>
                  <div style={{flex:1}}><label>First Name</label><input name="first_name" value={form.first_name} onChange={handleChange} required /></div>
                  <div style={{flex:1}}><label>Last Name</label><input name="last_name" value={form.last_name} onChange={handleChange} required /></div>
                </div>
                <div style={{display:'flex',gap:12}}>
                  <div style={{flex:1}}><label>Phone</label><input name="phone" value={form.phone} onChange={handleChange} /></div>
                  <div style={{flex:1}}><label>Location</label><input name="location" value={form.location} onChange={handleChange} /></div>
                </div>
                <div><label>Skills</label>
                  <Select
                    isMulti
                    isClearable
                    isSearchable
                    placeholder="Select or type skills..."
                    value={form.skills}
                    onChange={handleSkillsChange}
                    options={allSkills}
                    onCreateOption={handleCreateSkill}
                    formatCreateLabel={inputValue => `Add new skill: "${inputValue}"`}
                    styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
                  />
                </div>
                <div><label>Hourly Rate</label><input name="hourly_rate" value={form.hourly_rate} onChange={handleChange} type="number" step="0.01" /></div>
                {error && <div style={{color:'red'}}>{error}</div>}
                {success && <div style={{color:'green'}}>{success}</div>}
                <div className="projects-form-btns">
                  <button type="submit" className="projects-form-btn-primary" disabled={saving}>Add</button>
                  <button type="button" className="projects-form-btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Employees; 