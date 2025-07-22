import React, { useState, useEffect, useRef } from 'react';
import './ProductCatalogue.css';
import AddProducts from './AddProducts';

export default function ProductCatalogue() {
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, cost, materials_count, skills_count
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAddProductValid, setIsAddProductValid] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    model_name: '',
    total_cost: 0,
    materials_cost: 0,
    labor_cost: 0,
    photo_url: ''
  });
  const [saving, setSaving] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    material_id: '',
    quantity: 1
  });
  const [estimatedHours, setEstimatedHours] = useState(1);
  const [skillBreakdown, setSkillBreakdown] = useState([]);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [newSkill, setNewSkill] = useState({
    skill_id: ''
  });
  const addProductRef = useRef(null);

  useEffect(() => {
    fetchFinishedProducts();
    fetchAvailableMaterials();
    fetchAvailableSkills();
  }, []);

  const fetchFinishedProducts = () => {
    fetch("http://localhost:5001/finished_products")
      .then(res => res.json())
      .then(data => setFinishedProducts(Array.isArray(data) ? data : []))
      .catch(() => setFinishedProducts([]))
      .finally(() => setLoading(false));
  };

  const fetchAvailableMaterials = () => {
    fetch("http://localhost:5001/products")
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter(p => p.category && p.category.toLowerCase() !== 'product');
        setAvailableMaterials(filtered.map(p => ({
          label: p.name,
          value: p.id,
          cost: p.cost || 0,
          sku: p.sku,
          category: p.category,
          quantity: p.quantity // Use real quantity
        })));
      })
      .catch(() => setAvailableMaterials([]));
  };

  const fetchAvailableSkills = () => {
    fetch("http://localhost:5001/skills")
      .then(res => res.json())
      .then(data => setAvailableSkills(data.map(s => ({ label: s.name, value: s.id }))))
      .catch(() => setAvailableSkills([]));
  };

  // Filter and sort finished products
  const filteredProducts = finishedProducts
    .filter(product => {
      const matchesSearch = product.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.materials_json && product.materials_json.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesSearch;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.model_name.toLowerCase();
          bValue = b.model_name.toLowerCase();
          break;
        case 'cost':
          aValue = a.total_cost || 0;
          bValue = b.total_cost || 0;
          break;
        case 'materials_count':
          aValue = a.materials_count || 0;
          bValue = b.materials_count || 0;
          break;
        case 'skills_count':
          aValue = a.skills_count || 0;
          bValue = b.skills_count || 0;
          break;
        default:
          aValue = a.model_name.toLowerCase();
          bValue = b.model_name.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const getStatusBadge = (product) => {
    return <span className="status-badge finished">Finished Product</span>;
  };

  const getProductImage = (product) => {
    if (product.photo_url) {
      return `http://localhost:5001${product.photo_url}`;
    }
    // Return a placeholder for finished products
    return 'https://via.placeholder.com/200x200/F59E0B/FFFFFF?text=Finished+Product';
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setEditForm({
      model_name: product.model_name || '',
      total_cost: product.total_cost || 0,
      materials_cost: product.materials_cost || 0,
      labor_cost: product.labor_cost || 0,
      photo_url: product.photo_url || ''
    });
    
    // Parse materials and skills from the product
    if (product.materials_json) {
      try {
        const materials = JSON.parse(product.materials_json);
        setSelectedMaterials(materials.map(m => ({
          label: m.name,
          value: m.material_id,
          quantity: m.quantity,
          cost: availableMaterials.find(am => am.value === m.material_id)?.cost || 0
        })));
      } catch (e) {
        setSelectedMaterials([]);
      }
    } else {
      setSelectedMaterials([]);
    }
    
    // Initialize skills from the product
    if (product.skills && Array.isArray(product.skills)) {
      const skillsToSet = product.skills.map(skill => {
        if (typeof skill === 'string') {
          // Find the skill in available skills
          const availableSkill = availableSkills.find(s => s.label === skill);
          return availableSkill || { value: skill, label: skill };
        }
        return skill;
      });
      setSelectedSkills(skillsToSet);
    } else {
      setSelectedSkills([]);
    }
    
    // Set estimated hours (default to 1 if not available)
    setEstimatedHours(1);
    
    setShowEditModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingProduct(null);
    setEditForm({
      model_name: '',
      total_cost: 0,
      materials_cost: 0,
      labor_cost: 0,
      photo_url: ''
    });
    setSelectedMaterials([]);
    setSelectedSkills([]);
  };

  const handleEditFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const calculateTotalCost = (materials, laborCost) => {
    const materialsCost = materials.reduce((total, material) => {
      const availableMaterial = availableMaterials.find(am => am.value === material.value);
      return total + (availableMaterial?.cost || 0) * material.quantity;
    }, 0);
    
    return materialsCost + (laborCost || 0);
  };

  const handleAddMaterial = () => {
    if (!newMaterial.material_id) return;
    
    const selectedMaterial = availableMaterials.find(m => m.value === parseInt(newMaterial.material_id));
    if (!selectedMaterial) return;
    
    const materialToAdd = {
      value: parseInt(newMaterial.material_id),
      label: selectedMaterial.label,
      quantity: newMaterial.quantity,
      cost: selectedMaterial.cost,
      sku: selectedMaterial.sku,
      category: selectedMaterial.category
    };
    
    setSelectedMaterials(prev => [...prev, materialToAdd]);
    setNewMaterial({ material_id: '', quantity: 1 });
    setShowAddMaterial(false);
    
    // Update costs
    const newMaterialsCost = calculateTotalCost([...selectedMaterials, materialToAdd], editForm.labor_cost);
    setEditForm(prev => ({
      ...prev,
      materials_cost: newMaterialsCost - (editForm.labor_cost || 0),
      total_cost: newMaterialsCost
    }));
  };

  const handleRemoveMaterial = (index) => {
    const updatedMaterials = selectedMaterials.filter((_, i) => i !== index);
    setSelectedMaterials(updatedMaterials);
    
    // Update costs
    const newMaterialsCost = calculateTotalCost(updatedMaterials, editForm.labor_cost);
    setEditForm(prev => ({
      ...prev,
      materials_cost: newMaterialsCost - (editForm.labor_cost || 0),
      total_cost: newMaterialsCost
    }));
  };

  const handleUpdateMaterialQuantity = (index, newQuantity) => {
    const updatedMaterials = selectedMaterials.map((material, i) => 
      i === index ? { ...material, quantity: parseFloat(newQuantity) || 0 } : material
    );
    setSelectedMaterials(updatedMaterials);
    
    // Update costs
    const newMaterialsCost = calculateTotalCost(updatedMaterials, editForm.labor_cost);
    setEditForm(prev => ({
      ...prev,
      materials_cost: newMaterialsCost - (editForm.labor_cost || 0),
      total_cost: newMaterialsCost
    }));
  };

  const handleLaborCostChange = (value) => {
    const laborCost = parseFloat(value) || 0;
    const materialsCost = calculateTotalCost(selectedMaterials, 0);
    const totalCost = materialsCost + laborCost;
    
    setEditForm(prev => ({
      ...prev,
      labor_cost: laborCost,
      materials_cost: materialsCost,
      total_cost: totalCost
    }));
  };

  const calculateLaborCost = async () => {
    if (selectedSkills.length === 0) {
      setEditForm(prev => ({
        ...prev,
        labor_cost: 0
      }));
      setSkillBreakdown([]);
      return;
    }

    try {
      const requestBody = {
        skills: selectedSkills.map(s => s.label),
        estimated_hours: estimatedHours
      };
      
      const response = await fetch('http://localhost:5001/calculate-labor-cost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        
        const laborCost = data.labor_cost;
        const materialsCost = calculateTotalCost(selectedMaterials, 0);
        const totalCost = materialsCost + laborCost;
        
        setEditForm(prev => ({
          ...prev,
          labor_cost: laborCost,
          materials_cost: materialsCost,
          total_cost: totalCost
        }));
        
        setSkillBreakdown(data.skill_breakdown || []);
      } else {
        console.error('Failed to calculate labor cost');
      }
    } catch (error) {
      console.error('Error calculating labor cost:', error);
    }
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

  const handleEstimatedHoursChange = (value) => {
    const hours = parseFloat(value) || 1;
    setEstimatedHours(hours);
  };

  // Calculate labor cost whenever skills or hours change
  useEffect(() => {
    calculateLaborCost();
  }, [selectedSkills, estimatedHours]);

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    
    setSaving(true);
    
    try {
      const response = await fetch(`http://localhost:5001/finished_products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_name: editForm.model_name,
          total_cost: editForm.total_cost,
          materials_cost: editForm.materials_cost,
          labor_cost: editForm.labor_cost,
          photo_url: editForm.photo_url,
          materials: selectedMaterials.map(m => ({ 
            id: m.value, 
            name: m.label, 
            quantity: m.quantity 
          })),
          skills: selectedSkills.map(s => s.label)
        })
      });

      if (response.ok) {
        alert('Product updated successfully!');
        fetchFinishedProducts(); // Refresh the list
        closeEditModal();
      } else {
        const error = await response.json();
        alert('Failed to update product: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to update product: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this finished product?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/finished_products/${productId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Product deleted successfully!');
        fetchFinishedProducts(); // Refresh the list
        closeEditModal();
      } else {
        const error = await response.json();
        alert('Failed to delete product: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to delete product: ' + error.message);
    }
  };

  // Calculate how many finished products can be made from current inventory
  const getCanMakeCount = (product) => {
    if (!product.materials_json || !availableMaterials.length) return 0;
    try {
      const materials = JSON.parse(product.materials_json);
      if (!Array.isArray(materials) || materials.length === 0) return 0;
      let minCount = Infinity;
      for (const m of materials) {
        const stock = availableMaterials.find(mat => mat.value === m.material_id)?.quantity;
        if (typeof stock !== 'number' || stock < 0) return 0;
        const canMake = Math.floor(stock / m.quantity);
        if (canMake < minCount) minCount = canMake;
      }
      return isFinite(minCount) ? minCount : 0;
    } catch {
      return 0;
    }
  };

  if (loading) {
    return (
      <div className="catalogue-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading product catalogue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="catalogue-container">
      {/* Header */}
      <div className="catalogue-header">
        <div className="header-left">
          <h1 className="page-title">Finished Products Catalogue</h1>
          <p className="page-subtitle">Browse our complete collection of finished products and manufactured goods</p>
        </div>
        <div className="header-actions">
          <button 
            className="add-product-btn"
            onClick={() => setShowAddModal(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add Product
          </button>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <span className="stat-number">{finishedProducts.length}</span>
            <span className="stat-label">Total Products</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {finishedProducts.reduce((sum, p) => sum + (p.materials_count || 0), 0)}
            </span>
            <span className="stat-label">Total Materials</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">
              {finishedProducts.reduce((sum, p) => sum + (p.skills_count || 0), 0)}
            </span>
            <span className="stat-label">Total Skills</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="Search finished products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="name">Sort by Name</option>
            <option value="cost">Sort by Cost</option>
            <option value="materials_count">Sort by Materials</option>
            <option value="skills_count">Sort by Skills</option>
          </select>
          
          <button 
            className="sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="results-info">
        <span>Showing {filteredProducts.length} of {finishedProducts.length} finished products</span>
      </div>

      {/* Product Grid */}
      <div className="product-grid">
        {filteredProducts.length === 0 ? (
          <div className="no-results">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <h3>No finished products found</h3>
            <p>Try adjusting your search or add some finished products</p>
          </div>
        ) : (
          filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-image">
                <img src={getProductImage(product)} alt={product.model_name} />
                {getStatusBadge(product)}
              </div>
              
              <div className="product-info">
                <h3 className="product-name">{product.model_name}</h3>
                <p className="product-category">Finished Product</p>
                {/* Show required skills */}
                {product.skills && product.skills.length > 0 && (
                  <div className="product-skills">
                    <span className="detail-label">Skills:</span>
                    <span className="detail-value">
                      {product.skills.map((skill, idx) => (
                        <span key={idx} className="skill-badge">{skill}</span>
                      ))}
                    </span>
                  </div>
                )}
                
                <div className="product-details">
                  <div className="detail-row">
                    <span className="detail-label">Total Cost:</span>
                    <span className="detail-value">
                      ${(product.total_cost || 0).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="detail-label">Materials:</span>
                    <span className="detail-value">{product.materials_count} items</span>
                  </div>
                  
                  <div className="detail-row">
                    <span className="detail-label">Skills Required:</span>
                    <span className="detail-value">{product.skills_count}</span>
                  </div>
                </div>
                
                <div className="cost-breakdown">
                  <div className="breakdown-item">
                    <span>Materials: ${product.materials_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="breakdown-item">
                    <span>Labor: ${product.labor_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
              
              <div className="product-actions">
                <button 
                  className="action-btn view"
                  onClick={() => handleViewDetails(product)}
                >
                  View Details
                </button>
                <button 
                  className="action-btn edit"
                  onClick={() => handleEditProduct(product)}
                >
                  Edit
                </button>
                <button className="action-btn order">Order</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Product Details Modal */}
      {showModal && selectedProduct && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content product-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedProduct.model_name}</h2>
              <button className="close-btn" onClick={closeModal}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="product-details">
                <div className="product-image-large">
                  <img src={getProductImage(selectedProduct)} alt={selectedProduct.model_name} />
                </div>
                <div className="product-details-info">
                  <div className="detail-row">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{selectedProduct.model_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Total Cost:</span>
                    <span className="detail-value">${(selectedProduct.total_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Materials:</span>
                    <span className="detail-value">{selectedProduct.materials_count} items</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Skills Required:</span>
                    <span className="detail-value">
                      {selectedProduct.skills.map((skill, idx) => (
                        <span key={idx} className="skill-badge">{skill}</span>
                      ))}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Weight:</span>
                    <span className="detail-value">{selectedProduct.weight ? selectedProduct.weight + ' kg' : '1 kg'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Can Make Now:</span>
                    <span className="detail-value">{getCanMakeCount(selectedProduct)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Materials Cost:</span>
                    <span className="detail-value">${selectedProduct.materials_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Labor Cost:</span>
                    <span className="detail-value">${selectedProduct.labor_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                  {/* Materials Breakdown */}
                  {selectedProduct.materials_json && (
                    <div className="detail-row">
                      <span className="detail-label">Materials Breakdown:</span>
                      <span className="detail-value">
                        <div className="materials-list">
                          {JSON.parse(selectedProduct.materials_json).map((material, index) => (
                            <div key={index} className="material-item">
                              <span className="material-name">{material.name}</span>
                              <span className="material-quantity">Qty: {material.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </span>
                    </div>
                  )}
                  {/* Show required skills in modal */}
                  {selectedProduct.skills && selectedProduct.skills.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Skills Required:</span>
                      <span className="detail-value">
                        {selectedProduct.skills.map((skill, idx) => (
                          <span key={idx} className="skill-badge">{skill}</span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={closeModal}>
                Close
              </button>
              <button 
                className="modal-btn edit"
                onClick={() => {
                  closeModal();
                  handleEditProduct(selectedProduct);
                }}
              >
                Edit Product
              </button>
              <button className="modal-btn primary">
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Finished Product</h2>
              <button className="close-btn" onClick={closeEditModal}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="edit-form">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    value={editForm.model_name}
                    onChange={(e) => handleEditFormChange('model_name', e.target.value)}
                    placeholder="Enter product name"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Total Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.total_cost}
                      readOnly
                      className="readonly-input"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Materials Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.materials_cost}
                      readOnly
                      className="readonly-input"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Labor Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.labor_cost}
                      readOnly
                      className="readonly-input"
                      placeholder="0.00"
                    />
                  </div>
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
                
                <div className="form-group">
                  <label>Estimated Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={estimatedHours}
                    onChange={(e) => handleEstimatedHoursChange(e.target.value)}
                    placeholder="1"
                    min="0.5"
                  />
                </div>
                
                <div className="form-group">
                  <label>Required Skills</label>
                  <div className="skills-list-edit">
                    {selectedSkills.map((skill, index) => (
                      <div key={index} className="skill-item-edit">
                        <span>{skill.label}</span>
                        <button className="remove-skill-btn" onClick={() => handleRemoveSkill(index)}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13H5v-2h14v2z"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="add-skill-btn" onClick={() => setShowAddSkill(true)}>
                    Add Skill
                  </button>
                </div>
                
                <div className="form-group">
                  <label>Materials Used</label>
                  <div className="materials-list-edit">
                    {selectedMaterials.map((material, index) => (
                      <div key={index} className="material-item-edit">
                        <span>{material.label}</span>
                        <input
                          type="number"
                          value={material.quantity}
                          onChange={(e) => handleUpdateMaterialQuantity(index, e.target.value)}
                          placeholder="Qty"
                        />
                        <span>${material.cost}</span>
                        <button className="remove-material-btn" onClick={() => handleRemoveMaterial(index)}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 13H5v-2h14v2z"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="add-material-btn" onClick={() => setShowAddMaterial(true)}>
                    Add Material
                  </button>
                </div>
                
                <div className="cost-breakdown-edit">
                  <div className="cost-item">
                    <span className="cost-label">Materials Cost:</span>
                    <span className="cost-value">${editForm.materials_cost.toFixed(2)}</span>
                  </div>
                  <div className="cost-item">
                    <span className="cost-label">Labor Cost:</span>
                    <span className="cost-value">${editForm.labor_cost.toFixed(2)}</span>
                  </div>
                  <div className="cost-item total">
                    <span className="cost-label">Total Cost:</span>
                    <span className="cost-value">${editForm.total_cost.toFixed(2)}</span>
                  </div>
                </div>
                
                {skillBreakdown.length > 0 && (
                  <div className="skill-breakdown-edit">
                    <h4>Labor Cost Breakdown</h4>
                    <div className="skill-breakdown-list">
                      {skillBreakdown.map((skill, index) => (
                        <div key={index} className="skill-breakdown-item">
                          <div className="skill-info">
                            <span className="skill-name">{skill.skill}</span>
                            <span className="skill-rate">${skill.avg_hourly_rate}/hr</span>
                          </div>
                          <div className="skill-details">
                            <span>{skill.employees_count} employees</span>
                            <span>${skill.skill_cost.toFixed(2)}</span>
                          </div>
                          {skill.note && <span className="skill-note">{skill.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="modal-btn danger"
                onClick={() => handleDeleteProduct(editingProduct.id)}
                disabled={saving}
              >
                Delete Product
              </button>
              <button className="modal-btn secondary" onClick={closeEditModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="modal-btn primary"
                onClick={handleSaveEdit}
                disabled={saving || !editForm.model_name}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterial && (
        <div className="modal-overlay" onClick={() => setShowAddMaterial(false)}>
          <div className="modal-content add-material-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Material</h2>
              <button className="close-btn" onClick={() => setShowAddMaterial(false)}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="add-material-form">
                <div className="form-group">
                  <label>Material Name</label>
                  <select
                    value={newMaterial.material_id}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, material_id: e.target.value }))}
                  >
                    <option value="">Select a material</option>
                    {availableMaterials.map(material => (
                      <option key={material.value} value={material.value}>{material.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    value={newMaterial.quantity}
                    onChange={(e) => setNewMaterial(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                    placeholder="1"
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowAddMaterial(false)}>
                Cancel
              </button>
              <button className="modal-btn primary" onClick={handleAddMaterial}>
                Add Material
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content add-product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Finished Product</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <AddProducts 
                ref={addProductRef}
                onProductAdded={() => {
                  setShowAddModal(false);
                  fetchFinishedProducts(); // Refresh the list
                }}
                onCancel={() => setShowAddModal(false)}
                onValidityChange={setIsAddProductValid}
              />
            </div>
            
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button 
                className="modal-btn primary"
                onClick={() => {
                  if (addProductRef.current) {
                    addProductRef.current.handleSave();
                  }
                }}
                disabled={!isAddProductValid || addProductRef.current?.saving}
              >
                {addProductRef.current?.saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}