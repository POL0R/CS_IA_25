import React, { useState, useEffect, useRef } from 'react';
import './MaterialsCatalogue.css';
import AddMaterial from './AddMaterial';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MaterialsCatalogue() {
  const [materials, setMaterials] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddMaterialValid, setIsAddMaterialValid] = useState(false);
  const [isRestockValid, setIsRestockValid] = useState(false);
  const [addMaterialMode, setAddMaterialMode] = useState('new');
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    sku: '',
    category: '',
    cost: 0,
    unit: '',
    description: '',
    photo_url: ''
  });
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [newSkill, setNewSkill] = useState({ skill_id: '' });
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [saving, setSaving] = useState(false);
  const addMaterialRef = useRef(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [demandHistory, setDemandHistory] = useState([]);

  useEffect(() => {
    fetchMaterials();
    fetchAvailableSkills();
  }, []);

  const fetchMaterials = () => {
    fetch('http://localhost:5001/materials')
      .then(res => res.json())
      .then(data => {
        // Only show items that are not finished products (i.e., do not have a model_name or are not in finished_products)
        const filteredMaterials = data.filter(m => !m.model_name);
        setMaterials(filteredMaterials);
      })
      .catch(err => console.error('Error fetching materials:', err));
  };

  const fetchAvailableSkills = () => {
    fetch('http://localhost:5001/skills')
      .then(res => res.json())
      .then(data => {
        setAvailableSkills(data.map(s => ({
          value: s.id,
          label: s.name
        })));
      })
      .catch(err => console.error('Error fetching skills:', err));
  };

  const getMaterialImage = (material) => {
    if (material.photo_url) {
      return `http://localhost:5001${material.photo_url}`;
    }
    return '/placeholder-material.png'; // You can add a placeholder image
  };

  const handleViewDetails = (material) => {
    setSelectedMaterial(material);
    setShowModal(true);
    // Fetch real price and demand history
    fetch(`http://localhost:5001/materials/${material.id}/price_history`).then(res => res.json()).then(setPriceHistory);
    fetch(`http://localhost:5001/materials/${material.id}/demand_history`).then(res => res.json()).then(setDemandHistory);
  };

  const handleEditMaterial = (material) => {
    setEditingMaterial(material);
    setEditForm({
      name: material.name || '',
      sku: material.sku || '',
      category: material.category || '',
      cost: material.cost || 0,
      unit: material.unit || '',
      description: material.description || '',
      photo_url: material.photo_url || ''
    });
    
    // Initialize skills from the material
    if (material.skills && Array.isArray(material.skills)) {
      const skillsToSet = material.skills.map(skill => {
        if (typeof skill === 'string') {
          const availableSkill = availableSkills.find(s => s.label === skill);
          return availableSkill || { value: skill, label: skill };
        }
        return skill;
      });
      setSelectedSkills(skillsToSet);
    } else {
      setSelectedSkills([]);
    }
    
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMaterial(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingMaterial(null);
    setEditForm({
      name: '',
      sku: '',
      category: '',
      cost: 0,
      unit: '',
      description: '',
      photo_url: ''
    });
    setSelectedSkills([]);
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddSkill = () => {
    if (!newSkill.skill_id) return;
    
    const selectedSkill = availableSkills.find(s => s.value === parseInt(newSkill.skill_id));
    if (!selectedSkill) return;
    
    const skillToAdd = {
      value: parseInt(newSkill.skill_id),
      label: selectedSkill.label
    };
    
    setSelectedSkills(prev => [...prev, skillToAdd]);
    setNewSkill({ skill_id: '' });
    setShowAddSkill(false);
  };

  const handleRemoveSkill = (index) => {
    const updatedSkills = selectedSkills.filter((_, i) => i !== index);
    setSelectedSkills(updatedSkills);
  };

  const handleSaveEdit = async () => {
    if (!editingMaterial) return;
    
    setSaving(true);
    
    try {
      const response = await fetch(`http://localhost:5001/materials/${editingMaterial.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          sku: editForm.sku,
          category: editForm.category,
          cost: editForm.cost,
          unit: editForm.unit,
          description: editForm.description,
          photo_url: editForm.photo_url,
          skills: selectedSkills.map(s => s.label)
        })
      });

      if (response.ok) {
        alert('Material updated successfully!');
        fetchMaterials(); // Refresh the list
        closeEditModal();
      } else {
        const error = await response.json();
        alert('Failed to update material: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to update material: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMaterial = async (materialId) => {
    if (!confirm('Are you sure you want to delete this material?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/materials/${materialId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Material deleted successfully!');
        fetchMaterials(); // Refresh the list
        closeEditModal();
      } else {
        const error = await response.json();
        alert('Failed to delete material: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to delete material: ' + error.message);
    }
  };

  // Helper to generate mock data for 1 year
  function generateYearlyMockData(type = 'price') {
    const data = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      data.push({
        month: month.toLocaleString('default', { month: 'short', year: '2-digit' }),
        value: type === 'price'
          ? Math.round(80 + 40 * Math.sin(i / 2) + Math.random() * 20)
          : Math.round(100 + 60 * Math.cos(i / 3) + Math.random() * 30)
      });
    }
    return data;
  }

  return (
    <div className="materials-catalogue">
      <div className="catalogue-header">
        <div className="header-left">
          <h1>Materials Catalogue</h1>
          <p>Manage materials and their required skills</p>
        </div>
        <div className="header-actions">
          <button 
            className="add-material-btn"
            onClick={() => setShowAddModal(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add Material
          </button>
        </div>
      </div>

      <div className="materials-grid">
        {materials.map((material) => (
          <div key={material.id} className="material-card">
            <div className="material-image">
              <img src={getMaterialImage(material)} alt={material.name} />
            </div>
            <div className="material-info">
              <h3>{material.name}</h3>
              <p className="material-sku">SKU: {material.sku}</p>
              <p className="material-category">{material.category}</p>
              <p className="material-cost">${material.cost} per {material.unit}</p>
              
              {/* Stock Status */}
              <div className="material-stock">
                <span className={`stock-status ${material.stock_status}`}>
                  {material.stock_status === 'low' && '🔴 Low Stock'}
                  {material.stock_status === 'medium' && '🟡 Medium Stock'}
                  {material.stock_status === 'normal' && '🟢 Good Stock'}
                </span>
                <span className="stock-quantity">
                  {material.quantity} {material.unit} in stock
                </span>
              </div>
              
              {/* Supplier Information */}
              {material.supplier_info && (
                <div className="material-supplier">
                  <span className="supplier-label">Supplier:</span>
                  <span className="supplier-name">{material.supplier_info.name}</span>
                  {material.supplier_info.company && (
                    <span className="supplier-company">({material.supplier_info.company})</span>
                  )}
                </div>
              )}
              
              {/* Delivery Information */}
              {material.delivery_time && (
                <div className="material-delivery">
                  <span className="delivery-label">Delivery:</span>
                  <span className="delivery-time">
                    ~{material.delivery_time.estimated_days} days
                  </span>
                  <span className="delivery-distance">
                    ({material.delivery_time.distance_km} km)
                  </span>
                </div>
              )}
              
              {/* Delivery Performance */}
              {material.delivery_performance && (
                <div className="material-performance">
                  <span className="performance-label">Avg Delivery:</span>
                  <span className="performance-time">
                    {material.delivery_performance.avg_delivery_days} days
                  </span>
                  <span className="performance-orders">
                    ({material.delivery_performance.total_orders} orders)
                  </span>
                </div>
              )}
              
              {/* Remove Required Skills section from material card */}
            </div>
            <div className="material-actions">
              <button 
                className="action-btn view"
                onClick={() => handleViewDetails(material)}
              >
                View Details
              </button>
              <button 
                className="action-btn edit"
                onClick={() => handleEditMaterial(material)}
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Material Details Modal */}
      {showModal && selectedMaterial && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content material-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedMaterial.name}</h2>
              <button className="close-btn" onClick={closeModal}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="material-details">
                <div className="material-image-large">
                  <img src={getMaterialImage(selectedMaterial)} alt={selectedMaterial.name} />
                </div>
                
                <div className="material-details-info">
                  <div className="detail-row">
                    <span className="detail-label">SKU:</span>
                    <span className="detail-value">{selectedMaterial.sku}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Category:</span>
                    <span className="detail-value">{selectedMaterial.category}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Cost:</span>
                    <span className="detail-value">${selectedMaterial.cost} per {selectedMaterial.unit}</span>
                  </div>
                  
                  {/* Stock Information */}
                  <div className="detail-row">
                    <span className="detail-label">Stock Status:</span>
                    <div className="detail-value">
                      <span className={`stock-badge ${selectedMaterial.stock_status}`}>
                        {selectedMaterial.stock_status === 'low' && '🔴 Low Stock'}
                        {selectedMaterial.stock_status === 'medium' && '🟡 Medium Stock'}
                        {selectedMaterial.stock_status === 'normal' && '🟢 Good Stock'}
                      </span>
                      <span className="stock-details">
                        {selectedMaterial.quantity} {selectedMaterial.unit} in stock
                        {selectedMaterial.reorder_level && (
                          <span className="reorder-level">
                            (Reorder at {selectedMaterial.reorder_level} {selectedMaterial.unit})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  
                  {/* Supplier Information */}
                  {selectedMaterial.supplier_info && (
                    <div className="detail-row">
                      <span className="detail-label">Supplier:</span>
                      <div className="detail-value">
                        <div className="supplier-details">
                          <div className="supplier-name">{selectedMaterial.supplier_info.name}</div>
                          {selectedMaterial.supplier_info.company && (
                            <div className="supplier-company">{selectedMaterial.supplier_info.company}</div>
                          )}
                          {selectedMaterial.supplier_info.email && (
                            <div className="supplier-email">{selectedMaterial.supplier_info.email}</div>
                          )}
                          {selectedMaterial.supplier_info.phone && (
                            <div className="supplier-phone">{selectedMaterial.supplier_info.phone}</div>
                          )}
                          {selectedMaterial.supplier_info.address && (
                            <div className="supplier-address">{selectedMaterial.supplier_info.address}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Delivery Information */}
                  {selectedMaterial.delivery_time && (
                    <div className="detail-row">
                      <span className="detail-label">Delivery Time:</span>
                      <div className="detail-value">
                        <div className="delivery-details">
                          <div className="delivery-estimate">
                            ~{selectedMaterial.delivery_time.estimated_days} days
                            ({selectedMaterial.delivery_time.estimated_hours} hours)
                          </div>
                          <div className="delivery-distance">
                            Distance: {selectedMaterial.delivery_time.distance_km} km
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Delivery Performance */}
                  {selectedMaterial.delivery_performance && (
                    <div className="detail-row">
                      <span className="detail-label">Delivery Performance:</span>
                      <div className="detail-value">
                        <div className="performance-details">
                          <div className="performance-avg">
                            Average: {selectedMaterial.delivery_performance.avg_delivery_days} days
                          </div>
                          <div className="performance-orders">
                            Based on {selectedMaterial.delivery_performance.total_orders} orders
                          </div>
                          {selectedMaterial.delivery_performance.avg_expected_days && (
                            <div className="performance-expected">
                              Expected: {selectedMaterial.delivery_performance.avg_expected_days} days
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selectedMaterial.description && (
                    <div className="detail-row">
                      <span className="detail-label">Description:</span>
                      <span className="detail-value">{selectedMaterial.description}</span>
                    </div>
                  )}
                  
                  {/* Remove Required Skills section from material details modal */}
                </div>
              </div>
              <div className="material-graphs" style={{ marginTop: 32 }}>
                <h4>Price vs Time (1 year)</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={priceHistory.length ? priceHistory : generateYearlyMockData('price')} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="price" stroke="#8884d8" name="Price (₹)" />
                  </LineChart>
                </ResponsiveContainer>
                <h4 style={{ marginTop: 32 }}>Demand vs Time (1 year)</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={demandHistory.length ? demandHistory : generateYearlyMockData('demand')} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="demand" stroke="#82ca9d" name="Demand (units)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Material Modal */}
      {showEditModal && editingMaterial && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content edit-material-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Material</h2>
              <button className="close-btn" onClick={closeEditModal}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="edit-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Material Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => handleEditFormChange('name', e.target.value)}
                      placeholder="Enter material name"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>SKU</label>
                    <input
                      type="text"
                      value={editForm.sku}
                      onChange={(e) => handleEditFormChange('sku', e.target.value)}
                      placeholder="Enter SKU"
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => handleEditFormChange('category', e.target.value)}
                    >
                      <option value="">Select category</option>
                      <option value="raw_material">Raw Material</option>
                      <option value="component">Component</option>
                      <option value="tool">Tool</option>
                      <option value="equipment">Equipment</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Unit</label>
                    <input
                      type="text"
                      value={editForm.unit}
                      onChange={(e) => handleEditFormChange('unit', e.target.value)}
                      placeholder="e.g., pcs, kg, m"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Cost per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.cost}
                    onChange={(e) => handleEditFormChange('cost', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => handleEditFormChange('description', e.target.value)}
                    placeholder="Enter material description"
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label>Photo URL</label>
                  <input
                    type="text"
                    value={editForm.photo_url}
                    onChange={(e) => handleEditFormChange('photo_url', e.target.value)}
                    placeholder="Enter photo URL"
                  />
                </div>
                
                {/* Remove Required Skills section from edit material modal */}
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="modal-btn danger"
                onClick={() => handleDeleteMaterial(editingMaterial.id)}
                disabled={saving}
              >
                Delete Material
              </button>
              <button className="modal-btn secondary" onClick={closeEditModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="modal-btn primary"
                onClick={handleSaveEdit}
                disabled={saving || !editForm.name}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Skill Modal */}
      {showAddSkill && (
        <div className="modal-overlay" onClick={() => setShowAddSkill(false)}>
          <div className="modal-content add-skill-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Required Skill</h2>
              <button className="close-btn" onClick={() => setShowAddSkill(false)}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="add-skill-form">
                <div className="form-group">
                  <label>Skill Name</label>
                  <select
                    value={newSkill.skill_id}
                    onChange={(e) => setNewSkill(prev => ({ ...prev, skill_id: e.target.value }))}
                  >
                    <option value="">Select a skill</option>
                    {availableSkills.map(skill => (
                      <option key={skill.value} value={skill.value}>{skill.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowAddSkill(false)}>
                Cancel
              </button>
              <button className="modal-btn primary" onClick={handleAddSkill}>
                Add Skill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content add-material-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Material</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <AddMaterial 
                ref={addMaterialRef}
                onMaterialAdded={() => {
                  setShowAddModal(false);
                  fetchMaterials(); // Refresh the list
                }}
                onCancel={() => setShowAddModal(false)}
                onValidityChange={setIsAddMaterialValid}
                onRestockValidityChange={setIsRestockValid}
                onModeChange={setAddMaterialMode}
              />
            </div>
            
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              {/* Modal Footer: Show Save or Stock In depending on mode */}
              {addMaterialMode === 'existing' ? (
                <button 
                  className="modal-btn primary"
                  onClick={() => {
                    if (addMaterialRef.current) {
                      addMaterialRef.current.handleRestockSubmit();
                    }
                  }}
                  disabled={!isRestockValid || addMaterialRef.current?.loading}
                >
                  {addMaterialRef.current?.loading ? 'Processing...' : 'Stock In'}
                </button>
              ) : (
                <button 
                  className="modal-btn primary"
                  onClick={() => {
                    if (addMaterialRef.current) {
                      addMaterialRef.current.handleSubmit();
                    }
                  }}
                  disabled={!isAddMaterialValid || addMaterialRef.current?.loading}
                >
                  {addMaterialRef.current?.loading ? 'Saving...' : 'Save Material'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 