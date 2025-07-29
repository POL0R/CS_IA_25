import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import Select from 'react-select/creatable';

const AddProducts = forwardRef(({ onProductAdded, onCancel, onValidityChange }, ref) => {
  const [model, setModel] = useState("");
  const [materials, setMaterials] = useState([]); // [{ material, quantity }]
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialQuantity, setMaterialQuantity] = useState(1);
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [skills, setSkills] = useState([]); // All available skills
  const [selectedSkills, setSelectedSkills] = useState([]); // Selected skills for this product
  const [estimatedHours, setEstimatedHours] = useState('1');
  const [laborCost, setLaborCost] = useState(0);
  const [skillBreakdown, setSkillBreakdown] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [weight, setWeight] = useState(1); // Default arbitrary weight
  const [phaseType, setPhaseType] = useState("");
  const [mountType, setMountType] = useState("");
  const [complianceTags, setComplianceTags] = useState([]);
  const [features, setFeatures] = useState([]);
  const [applicationTags, setApplicationTags] = useState([]);
  const [voltageRating, setVoltageRating] = useState("");
  const [minLoadKw, setMinLoadKw] = useState("");
  const [maxLoadKw, setMaxLoadKw] = useState("");
  const [featuresOptions, setFeaturesOptions] = useState([]);
  const [complianceOptions, setComplianceOptions] = useState([]);
  const [applicationTagOptions, setApplicationTagOptions] = useState([]);
  const [profitMarginPercent, setProfitMarginPercent] = useState(20.0); // Default 20% profit margin

  // Expose functions and state to parent component
  useImperativeHandle(ref, () => ({
    handleSave,
    isValid: model && materials.length > 0 && selectedSkills.length > 0 && !saving && !uploadingImage && weight > 0,
    saving
  }));

  useEffect(() => {
    fetch("http://localhost:5001/products")
      .then(res => res.json())
      .then(data => {
        // Only include tools, components, and raw materials
        const filtered = data.filter(p => p.category && p.category.toLowerCase() !== 'product');
        setAvailableMaterials(filtered.map(p => ({
          label: p.name,
          value: p.id,
          cost: p.cost || 0,
          sku: p.sku,
          category: p.category
        })));
      })
      .catch(() => setAvailableMaterials([]));
    fetch("http://localhost:5001/skills")
      .then(res => res.json())
      .then(data => setSkills(data.map(s => ({ label: s.name, value: s.id }))))
      .catch(() => setSkills([]));
    fetch("http://localhost:5001/features")
      .then(res => res.json())
      .then(data => setFeaturesOptions(data.map(f => ({ label: f.name, value: f.name }))))
      .catch(() => setFeaturesOptions([]));
    fetch("http://localhost:5001/compliance_tags")
      .then(res => res.json())
      .then(data => setComplianceOptions(data.map(c => ({ label: c.name, value: c.name }))))
      .catch(() => setComplianceOptions([]));
    fetch("http://localhost:5001/application-tags")
      .then(res => res.json())
      .then(data => setApplicationTagOptions(data.map(t => ({ label: t.name, value: t.name }))))
      .catch(() => setApplicationTagOptions([]));
  }, []);

  useEffect(() => {
    if (typeof onValidityChange === 'function') {
      const valid = model && materials.length > 0 && selectedSkills.length > 0 && !saving && !uploadingImage && weight > 0;
      onValidityChange(!!valid);
    }
  }, [model, materials, selectedSkills, saving, uploadingImage, weight, onValidityChange]);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async () => {
    if (!selectedImage) return null;
    
    setUploadingImage(true);
    const formData = new FormData();
    formData.append('photo', selectedImage);
    
    try {
      const response = await fetch('http://localhost:5001/products/upload-photo', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setUploadedImageUrl(data.url);
        setUploadingImage(false);
        return data.url;
      } else {
        throw new Error('Failed to upload image');
      }
    } catch (error) {
      setUploadingImage(false);
      alert('Failed to upload image: ' + error.message);
      return null;
    }
  };

  const handleAddMaterial = () => {
    if (!selectedMaterial || !materialQuantity || materialQuantity <= 0) return;
    setMaterials(prev => [
      ...prev,
      {
        ...selectedMaterial,
        quantity: materialQuantity,
        totalCost: selectedMaterial.cost * materialQuantity
      }
    ]);
    setSelectedMaterial(null);
    setMaterialQuantity(1);
  };

  const handleRemoveMaterial = (idx) => {
    setMaterials(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreateSkill = (inputValue) => {
    // Add new skill to backend and update local state
    fetch("http://localhost:5001/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inputValue })
    })
      .then(res => res.json())
      .then(newSkill => {
        const skillOption = { label: newSkill.name, value: newSkill.id };
        setSkills(prev => [...prev, skillOption]);
        // Add to selected skills and trigger labor cost calculation
        setSelectedSkills(prev => {
          const updated = [...prev, skillOption];
          return updated;
        });
      });
  };

  const handleSkillsChange = (newSelectedSkills) => {
    setSelectedSkills(newSelectedSkills);
    // No setTimeout, calculation will be triggered by useEffect
  };

  const handleEstimatedHoursChange = (e) => {
    setEstimatedHours(e.target.value);
    // No setTimeout, calculation will be triggered by useEffect
  };

  const calculateLaborCost = useCallback(async () => {
    if (selectedSkills.length === 0) {
      setLaborCost(0);
      setSkillBreakdown([]);
      return;
    }

    try {
      const requestBody = {
        skills: selectedSkills.map(s => s.label),
        estimated_hours: parseFloat(estimatedHours) || 1
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
        setLaborCost(data.labor_cost);
        setSkillBreakdown(data.skill_breakdown || []);
      } else {
        console.error('Failed to calculate labor cost');
      }
    } catch (error) {
      console.error('Error calculating labor cost:', error);
    }
  }, [selectedSkills, estimatedHours]);

  // Calculate labor cost whenever skills or hours change
  useEffect(() => {
    if (selectedSkills.length > 0 && parseFloat(estimatedHours) > 0) {
    calculateLaborCost();
    } else {
      setLaborCost(0);
      setSkillBreakdown([]);
    }
  }, [selectedSkills, estimatedHours, calculateLaborCost]);

  const totalCost = materials.reduce((sum, m) => sum + (m.totalCost || 0), 0) + laborCost;

  const handleSave = async () => {
    setSaving(true);
    
    // Upload image first if selected
    let imageUrl = uploadedImageUrl;
    if (selectedImage && !uploadedImageUrl) {
      imageUrl = await uploadImage();
    }
    
    fetch("http://localhost:5001/finished_products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_name: model,
        total_cost: totalCost,
        profit_margin_percent: profitMarginPercent,
        materials_cost: materials.reduce((sum, m) => sum + (m.totalCost || 0), 0),
        labor_cost: laborCost,
        skills: selectedSkills.map(s => s.label), // send skill names (API will create if needed)
        materials: materials.map(m => ({ id: m.value, name: m.label, quantity: m.quantity })), // send id, name, and quantity
        photo_url: imageUrl, // include the uploaded image URL
        weight: weight, // Include weight
        phase_type: phaseType,
        mount_type: mountType,
        compliance_tags: complianceTags,
        features: features,
        application_tags: applicationTags,
        voltage_rating: voltageRating ? parseInt(voltageRating) : null,
        min_load_kw: minLoadKw ? parseInt(minLoadKw) : null,
        max_load_kw: maxLoadKw ? parseInt(maxLoadKw) : null
      })
    })
      .then(async res => {
        const data = await res.json();
        setSaving(false);
        if (res.ok && data.id) {
          // Reset form
          setModel("");
          setMaterials([]);
          setSelectedSkills([]);
          setEstimatedHours('1');
          setLaborCost(0);
          setSkillBreakdown([]);
          setSelectedImage(null);
          setImagePreview(null);
          setUploadedImageUrl(null);
          onProductAdded(); // Call the prop function
        } else {
          alert('Failed to save product. ' + (data.error || ''));
        }
      })
      .catch((err) => {
        setSaving(false);
        alert('Failed to save product. ' + (err.message || ''));
      });
  };

  return (
    <div>
      {/* Product Image Upload */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Product Image</label>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ 
                width: '100%', 
                padding: '10px', 
                borderRadius: 6, 
                border: '1px solid #ccc', 
                fontSize: 16,
                backgroundColor: '#f9fafb'
              }}
            />
            <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Supported formats: JPG, PNG, GIF (Max 5MB)
            </p>
          </div>
          {uploadingImage && (
            <div style={{ 
              padding: '8px 12px', 
              background: '#fef3c7', 
              color: '#92400e', 
              borderRadius: 6,
              fontSize: 14
            }}>
              Uploading...
            </div>
          )}
        </div>
        
        {/* Image Preview */}
        {(imagePreview || uploadedImageUrl) && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 600 }}>Preview:</h4>
            <div style={{ 
              width: 200, 
              height: 200, 
              border: '2px dashed #d1d5db', 
              borderRadius: 8,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f9fafb'
            }}>
              <img 
                src={uploadedImageUrl ? `http://localhost:5001${uploadedImageUrl}` : imagePreview} 
                alt="Product preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain' 
                }} 
              />
            </div>
            {uploadedImageUrl && (
              <p style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
                ✓ Image uploaded successfully
              </p>
            )}
          </div>
        )}
      </div>
      
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Product Model *</label>
        <input
          type="text"
          value={model}
          onChange={e => setModel(e.target.value)}
          placeholder="e.g. iPhone 15 Pro Max"
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Add Required Materials</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 2 }}>
            <Select
              isClearable
              isSearchable
              placeholder="Select or type material..."
              value={selectedMaterial}
              onChange={setSelectedMaterial}
              options={availableMaterials}
              formatCreateLabel={inputValue => `Add new material: "${inputValue}"`}
              styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
              getOptionLabel={option => `${option.label} (${option.category || ''}${option.sku ? ' | ' + option.sku : ''})${option.cost ? ' - $' + option.cost : ''}`}
            />
          </div>
          <input
            type="number"
            min={1}
            value={materialQuantity}
            onChange={e => setMaterialQuantity(Number(e.target.value))}
            style={{ width: 80, padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
            placeholder="Qty"
          />
          <button
            type="button"
            onClick={handleAddMaterial}
            style={{ padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
            disabled={!selectedMaterial || !materialQuantity || materialQuantity <= 0}
          >
            Add
          </button>
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Skills Required to Make</label>
        <Select
          isMulti
          isClearable
          isSearchable
          placeholder="Select or type skills..."
          value={selectedSkills}
          onChange={handleSkillsChange}
          options={skills}
          onCreateOption={handleCreateSkill}
          formatCreateLabel={inputValue => `Add new skill: "${inputValue}"`}
          styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
        />
      </div>
      
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Estimated Hours</label>
        <input
          type="number"
          step="0.5"
          value={estimatedHours}
          onChange={handleEstimatedHoursChange}
          placeholder="1"
          min="0.5"
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Product Weight (kg)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={weight}
          onChange={e => setWeight(parseFloat(e.target.value) || 0)}
          placeholder="Enter product weight"
          required
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Profit Margin (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={profitMarginPercent}
          onChange={e => setProfitMarginPercent(parseFloat(e.target.value) || 0)}
          placeholder="Enter profit margin percentage"
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        />
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          This percentage will be added to your total cost to calculate the selling price
        </div>
      </div>
      
      {selectedSkills.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Labor Cost Breakdown</h3>
          <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Total Labor Cost:</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>${laborCost.toFixed(2)}</span>
            </div>
            {skillBreakdown.length > 0 && (
              <div style={{ fontSize: 14, color: '#6b7280' }}>
                {skillBreakdown.map((skill, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{skill.skill} (${skill.avg_hourly_rate}/hr × {parseFloat(estimatedHours) || 1}hrs)</span>
                    <span>${skill.skill_cost.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {materials.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Materials List</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Material</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Category</th>
                <th style={{ padding: 8, textAlign: 'left' }}>SKU</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Unit Cost</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m, idx) => (
                <tr key={idx}>
                  <td style={{ padding: 8 }}>{m.label}</td>
                  <td style={{ padding: 8 }}>{m.category}</td>
                  <td style={{ padding: 8 }}>{m.sku}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>${m.cost}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{m.quantity}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>${m.totalCost}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    <button onClick={() => handleRemoveMaterial(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginBottom: 32, textAlign: 'right', fontSize: 18, fontWeight: 700 }}>
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#6b7280' }}>
          Materials Cost: <span style={{ color: '#374151' }}>${materials.reduce((sum, m) => sum + (m.totalCost || 0), 0).toFixed(2)}</span>
        </div>
        {selectedSkills.length > 0 && (
          <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#6b7280' }}>
            Labor Cost: <span style={{ color: '#374151' }}>${laborCost.toFixed(2)}</span>
          </div>
        )}
        <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 8 }}>
          Total Cost: <span style={{ color: '#6366f1' }}>${totalCost.toFixed(2)}</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: '#059669' }}>
          Selling Price: <span style={{ color: '#059669' }}>${(totalCost * (1 + profitMarginPercent / 100)).toFixed(2)}</span>
          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
            (includes {profitMarginPercent}% profit margin)
          </span>
        </div>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Phase Type</label>
        <select value={phaseType} onChange={e => setPhaseType(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}>
          <option value="">Select phase type</option>
          <option value="Single">Single</option>
          <option value="3-phase">3-phase</option>
        </select>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Mount Type</label>
        <select value={mountType} onChange={e => setMountType(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}>
          <option value="">Select mount type</option>
          <option value="Indoor">Indoor</option>
          <option value="Outdoor">Outdoor</option>
        </select>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Compliance Tags</label>
        <Select
          isMulti
          isClearable
          isSearchable
          placeholder="Add or select compliance tags..."
          value={complianceTags.map(tag => ({ label: tag, value: tag }))}
          onChange={selected => setComplianceTags(selected ? selected.map(opt => opt.value) : [])}
          options={complianceOptions}
          formatCreateLabel={inputValue => `Add: "${inputValue}"`}
          styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Features</label>
        <Select
          isMulti
          isClearable
          isSearchable
          placeholder="Add or select features..."
          value={features.map(tag => ({ label: tag, value: tag }))}
          onChange={selected => setFeatures(selected ? selected.map(opt => opt.value) : [])}
          options={featuresOptions}
          formatCreateLabel={inputValue => `Add: "${inputValue}"`}
          styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Application Tags</label>
        <Select
          isMulti
          isClearable
          isSearchable
          placeholder="Add or select application tags..."
          value={applicationTags.map(tag => ({ label: tag, value: tag }))}
          onChange={selected => setApplicationTags(selected ? selected.map(opt => opt.value) : [])}
          options={applicationTagOptions}
          formatCreateLabel={inputValue => `Add: "${inputValue}"`}
          styles={{ menu: base => ({ ...base, zIndex: 9999 }) }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Voltage Rating (V)</label>
        <input
          type="number"
          min="0"
          value={voltageRating}
          onChange={e => setVoltageRating(e.target.value)}
          placeholder="Enter voltage rating"
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
        />
      </div>
      <div style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Min Load (kW)</label>
          <input
            type="number"
            min="0"
            value={minLoadKw}
            onChange={e => setMinLoadKw(e.target.value)}
            placeholder="Min kW"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Max Load (kW)</label>
          <input
            type="number"
            min="0"
            value={maxLoadKw}
            onChange={e => setMaxLoadKw(e.target.value)}
            placeholder="Max kW"
            style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 16 }}
          />
        </div>
      </div>
    </div>
  );
});

export default AddProducts; 