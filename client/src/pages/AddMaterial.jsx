import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import "./AddMaterial.css";
import Select from 'react-select/creatable';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwEiCiSM2w0TQ-n4PA0vUl2UTDKSjtePgKMRL08_XIHmg5U6cQRtIyJQpqOQbesTjFjDg/exec'; // TODO: Replace with your actual Apps Script URL

const AddMaterial = forwardRef(({ onMaterialAdded, onCancel, onValidityChange, onRestockValidityChange, onModeChange }, ref) => {
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    cost: 0,
    reorder_level: 0,
    supplier: '',
    type: 'Product',
    location: '',
    photo_url: ''
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [mode, setMode] = useState('new'); // 'new' or 'existing'
  const [restockData, setRestockData] = useState({ product_id: '', quantity: 0, supplier: '', location: '', cost_per_unit: '' });
  const [imagePreview, setImagePreview] = useState(null);
  const itemTypes = ['Tool', 'Component', 'Raw Material'];
  
  // Use ref to track emails sent in current session (prevents duplicates on re-renders)
  const emailsSentThisSession = useRef(new Set());

  // Expose functions and state to parent component
  useImperativeHandle(ref, () => ({
    handleSubmit,
    handleRestockSubmit,
    isValid: formData.name && formData.quantity >= 0 && formData.cost >= 0 && formData.reorder_level >= 0,
    loading,
    mode
  }));

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    const valid = formData.name && formData.quantity >= 0 && formData.cost >= 0 && formData.reorder_level >= 0 && formData.supplier && formData.location && formData.type;
    if (onValidityChange) onValidityChange(!!valid);
  }, [formData, onValidityChange]);

  useEffect(() => {
    const valid = restockData.product_id && restockData.quantity > 0 && restockData.cost_per_unit >= 0 && restockData.supplier && restockData.location;
    if (typeof onRestockValidityChange === 'function') onRestockValidityChange(!!valid);
  }, [restockData, onRestockValidityChange]);

  useEffect(() => {
    if (typeof onModeChange === 'function') onModeChange(mode);
  }, [mode, onModeChange]);

  const fetchProducts = () => {
    fetch("http://localhost:5001/products")
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(() => setProducts([]));
  };

  const fetchSuppliers = () => {
    fetch("http://localhost:5001/suppliers")
      .then(res => res.json())
      .then(data => setSuppliers(data))
      .catch(() => setSuppliers([]));
  };

  const fetchWarehouses = () => {
    fetch("http://localhost:5001/warehouses")
      .then(res => res.json())
      .then(data => setWarehouses(data))
      .catch(() => setWarehouses([]));
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    // Upload to backend
    const formDataObj = new FormData();
    formDataObj.append('file', file);
    try {
      const res = await fetch('http://localhost:5001/materials/upload-photo', {
        method: 'POST',
        body: formDataObj
      });
      const data = await res.json();
      if (data.url) {
        setFormData(prev => ({ ...prev, photo_url: data.url }));
      } else {
        alert('Image upload failed');
      }
    } catch (err) {
      alert('Image upload failed: ' + err.message);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    // Robust validation
    const requiredFields = ['name', 'quantity', 'cost', 'reorder_level', 'supplier'];
    for (const field of requiredFields) {
      if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
        alert(`Please fill in the required field: ${field}`);
        return;
      }
    }
    // Numeric validation
    if (isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0) {
      alert('Quantity must be a non-negative number');
      return;
    }
    if (isNaN(Number(formData.cost)) || Number(formData.cost) < 0) {
      alert('Cost must be a non-negative number');
      return;
    }
    if (isNaN(Number(formData.reorder_level)) || Number(formData.reorder_level) < 0) {
      alert('Reorder level must be a non-negative number');
      return;
    }
    // Trim string fields
    const payload = { ...formData };
    for (const key in payload) {
      if (typeof payload[key] === 'string') payload[key] = payload[key].trim();
    }
    
    // Map frontend fields to backend expectations
    payload.category = payload.type && payload.type.trim() ? payload.type.trim() : 'Product'; // Always set a valid category
    payload.unit = 'units'; // Default unit
    delete payload.type; // Remove the 'type' field
    
    // Handle supplier - if it's a supplier name, we need to find the supplier_id
    if (payload.supplier && payload.supplier !== 'Not decided yet') {
      const supplier = suppliers.find(s => s.name === payload.supplier);
      if (supplier) {
        payload.supplier_id = supplier.id;
        delete payload.supplier; // Remove supplier name, keep supplier_id
      } else {
        // If supplier not found, do not send supplier_id at all
        delete payload.supplier;
        delete payload.supplier_id;
      }
    } else {
      delete payload.supplier; // Remove supplier if not decided
      delete payload.supplier_id;
    }
    
    // Generate random SKU if not present
    payload.sku = 'SKU-' + Math.random().toString(36).substr(2, 8).toUpperCase();
    if (formData.photo_url) payload.photo_url = formData.photo_url;
    setLoading(true);
    fetch("http://localhost:5001/products", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.success) {
          // Reset form
          setFormData({
            name: '', quantity: 0, cost: 0, reorder_level: 0, supplier: '', type: '', location: '', photo_url: ''
          });
          setImagePreview(null); // Clear preview on successful submission
          fetchProducts();
          onMaterialAdded(); // Notify parent
        } else {
          alert('Error: ' + (data.error || 'Failed to add product'));
        }
      })
      .catch(error => {
        setLoading(false);
        alert('Error: ' + error.message);
      });
  };

  const handleRestockChange = (e) => {
    setRestockData({
      ...restockData,
      [e.target.name]: e.target.value
    });
  };

  // Prefill cost_per_unit when product is selected
  useEffect(() => {
    if (restockData.product_id) {
      const selectedProduct = products.find(p => p.id.toString() === restockData.product_id);
      if (selectedProduct) {
        setRestockData(prev => ({ ...prev, cost_per_unit: selectedProduct.cost || '' }));
      }
    }
    // eslint-disable-next-line
  }, [restockData.product_id]);

  const handleRestockSubmit = (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    fetch("http://localhost:5001/transactions", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stock_in',
        product_id: restockData.product_id,
        quantity: parseFloat(restockData.quantity),
        location: restockData.location || 'Main Warehouse',
        supplier: restockData.supplier,
        cost_per_unit: parseFloat(restockData.cost_per_unit)
      })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.success) {
          alert('Stock in successful!');
          setRestockData({ product_id: '', quantity: 0, supplier: '', location: '', cost_per_unit: '' });
          
          // Clear session tracking for this product to allow future low stock emails
          emailsSentThisSession.current.delete(parseInt(restockData.product_id));
          
          fetchProducts();
          onMaterialAdded(); // Notify parent
        } else {
          alert('Error: ' + (data.error || 'Failed to stock in'));
        }
      })
      .catch(error => {
        setLoading(false);
        alert('Error: ' + error.message);
      });
  };

  // Sort products by quantity ascending (low stock first)
  const sortedProducts = [...products].sort((a, b) => a.quantity - b.quantity);

  // Helper to get most frequent supplier for a product
  const getMostFrequentSupplier = async (productId) => {
    // First, try to get supplier from product directly using supplier_id
    const product = products.find(p => p.id === productId);
    if (product && product.supplier_id) {
      const supplierObj = suppliers.find(s => s.id === product.supplier_id);
      if (supplierObj) return supplierObj;
    }
    
    // Fallback to transaction-based logic using supplier_id
    const res = await fetch(`http://localhost:5001/transactions`);
    const transactions = await res.json();
    const stockInTx = transactions.filter(t => t.type === 'stock_in' && t.product_id === productId && t.supplier_id);
    if (stockInTx.length === 0) return null;
    
    // Count frequency by supplier_id
    const freq = {};
    stockInTx.forEach(t => {
      freq[t.supplier_id] = (freq[t.supplier_id] || 0) + 1;
    });
    
    // Find most frequent supplier_id
    let max = 0, mostFrequentSupplierId = null;
    for (const supplierId in freq) {
      if (freq[supplierId] > max) {
        max = freq[supplierId];
        mostFrequentSupplierId = parseInt(supplierId);
      }
    }
    
    // Find supplier object by ID
    return suppliers.find(s => s.id === mostFrequentSupplierId);
  };

  // Helper to send email via Apps Script
  const sendLowStockEmail = async (product) => {
    if (!product.sku) return;
    
    // Check if email has already been sent in this session
    if (emailsSentThisSession.current.has(product.id)) {
      console.log(`Email already sent for product ${product.name} in this session`);
      return;
    }
    
    // Check if email has already been sent (email_sent_count > 0)
    if (product.email_sent_count > 0) {
      console.log(`Email already sent for product ${product.name} (count: ${product.email_sent_count})`);
      return;
    }
    
    const supplier = await getMostFrequentSupplier(product.id);
    if (!supplier || !supplier.email) {
      console.warn('No supplier or supplier email found for product', product.name);
      return;
    }
    
    const payload = {
      Name: supplier.name,
      Email: supplier.email,
      Product: product.name,
      Quantity: product.quantity,
      RecommendedOrder: (product.reorder_level || 0) + 5
    };
    
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      // Increment email sent count in database
      await fetch(`http://localhost:5001/products/${product.id}/increment-email-count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Update local state to reflect the change
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === product.id 
            ? { ...p, email_sent_count: (p.email_sent_count || 0) + 1 }
            : p
        )
      );
      
      // Mark this product as having sent an email in this session
      emailsSentThisSession.current.add(product.id);
      
      console.log(`Low stock email sent for product ${product.name} to ${supplier.name}`);
      
    } catch (err) {
      console.error('Error sending low stock email:', err);
      alert('Error sending low stock email: ' + err.message);
    }
  };

  // Send low stock emails only once per product per render
  useEffect(() => {
    // Only run if we have products and suppliers loaded
    if (products.length === 0 || suppliers.length === 0) return;
    
    sortedProducts.forEach(product => {
      const isLow = product.quantity <= (product.reorder_level || 0);
      if (isLow && product.email_sent_count === 0) {
        sendLowStockEmail(product);
      }
    });
    // eslint-disable-next-line
  }, [products, suppliers]); // Only depend on products and suppliers, not sortedProducts

  // Get suppliers based on selected product type
  const getFilteredSuppliers = () => {
    if (!restockData.product_id) return [];
    const selectedProduct = products.find(p => p.id.toString() === restockData.product_id);
    if (!selectedProduct) return [];
    // If product has a suppliers array (multiple suppliers)
    if (Array.isArray(selectedProduct.suppliers)) {
      return suppliers.filter(s => selectedProduct.suppliers.includes(s.id));
    }
    // If product has a supplier_id field (single supplier by id)
    if (selectedProduct.supplier_id) {
      return suppliers.filter(s => s.id === selectedProduct.supplier_id);
    }
    // If product has a supplier field (single supplier by name)
    if (selectedProduct.supplier) {
      return suppliers.filter(s => s.name === selectedProduct.supplier);
    }
    return [];
  };

  // Helper to get supplier name from supplier_id
  const getSupplierName = (supplierId) => {
    if (!supplierId) return '-';
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : '-';
  };

  return (
    <div>
      <div className="mode-selector">
          <button
          type="button" 
          className={`mode-btn ${mode === 'new' ? 'active' : ''}`}
            onClick={() => setMode('new')}
          >
          Add New Material
          </button>
          <button
          type="button" 
          className={`mode-btn ${mode === 'existing' ? 'active' : ''}`}
            onClick={() => setMode('existing')}
          >
          Restock Existing
          </button>
        </div>

        {mode === 'new' ? (
          <form className="add-product-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
              <label>Material Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
              <label>Initial Quantity *</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} min="0" required />
              </div>
              <div className="form-group">
              <label>Cost per Unit *</label>
              <input type="number" name="cost" value={formData.cost} onChange={handleChange} min="0" step="0.01" required />
              </div>
              <div className="form-group">
              <label>Reorder Level *</label>
              <input type="number" name="reorder_level" value={formData.reorder_level} onChange={handleChange} min="0" required />
              </div>
              <div className="form-group">
                <label>Supplier *</label>
                <Select
                  isClearable
                  isSearchable
                placeholder={`Search from ${suppliers.length} suppliers...`}
                value={formData.supplier ? { label: formData.supplier, value: formData.supplier } : null}
                onChange={option => handleChange({ target: { name: 'supplier', value: option ? option.value : '' } })}
                  options={[
                  ...suppliers.map(s => ({ 
                    label: `${s.name}${s.company ? ' (' + s.company + ')' : ''}${s.specialty ? ' - ' + s.specialty : ''}`, 
                    value: s.name 
                  })),
                    { label: 'Not decided yet', value: 'Not decided yet' }
                  ]}
                  formatCreateLabel={inputValue => `Add new supplier: "${inputValue}"`}
                styles={{ 
                  menu: base => ({ ...base, zIndex: 9999 }),
                  menuList: base => ({ ...base, maxHeight: '200px' }),
                  option: (base, state) => ({
                    ...base,
                    fontSize: '14px',
                    padding: '8px 12px'
                  })
                }}
                  filterOption={(option, inputValue) => {
                    const searchIn = option.label.toLowerCase();
                    const searchFor = inputValue.toLowerCase();
                    return searchIn.includes(searchFor);
                  }}
                  noOptionsMessage={({ inputValue }) => 
                    inputValue ? `No suppliers found matching "${inputValue}"` : 'No suppliers available'
                  }
                />
              </div>
              <div className="form-group">
                <label>Warehouse *</label>
                <select name="location" value={formData.location || ''} onChange={handleChange} required>
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select name="type" value={formData.type || ''} onChange={handleChange} required>
                  <option value="">Select type</option>
                  {itemTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            <div className="form-group">
              <label>Material Image</label>
              <input type="file" accept="image/*" onChange={handleImageChange} />
              {imagePreview && (
                <div style={{ marginTop: 8 }}>
                  <img src={imagePreview} alt="Preview" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 8, border: '1px solid #ccc' }} />
                </div>
              )}
            </div>
            </div>
          </form>
        ) : (
          <form className="add-product-form" onSubmit={handleRestockSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Product *</label>
                <Select
                  isClearable
                  isSearchable
                  placeholder={`Search from ${products.length} products...`}
                  value={
                    restockData.product_id
                      ? {
                          label: (() => {
                            const p = products.find(prod => prod.id.toString() === restockData.product_id);
                            return p ? `${p.name} (${p.sku}) - ${p.type || p.category}` : '';
                          })(),
                          value: restockData.product_id
                        }
                      : null
                  }
                  onChange={option =>
                    handleRestockChange({
                      target: { name: 'product_id', value: option ? option.value : '' }
                    })
                  }
                  options={products.map(product => ({
                    label: `${product.name} (${product.sku}) - ${product.type || product.category}`,
                    value: product.id.toString()
                  }))}
                  styles={{
                    menu: base => ({ ...base, zIndex: 9999 }),
                    menuList: base => ({ ...base, maxHeight: '200px' }),
                    option: (base, state) => ({
                      ...base,
                      fontSize: '14px',
                      padding: '8px 12px'
                    })
                  }}
                  noOptionsMessage={({ inputValue }) =>
                    inputValue
                      ? `No products found matching "${inputValue}"`
                      : 'No products available'
                  }
                />
              </div>
              <div className="form-group">
                <label>Quantity *</label>
                <input type="number" name="quantity" value={restockData.quantity} onChange={handleRestockChange} min="1" required />
              </div>
              <div className="form-group">
                <label>Unit Price *</label>
                <input type="number" name="cost_per_unit" value={restockData.cost_per_unit} onChange={handleRestockChange} min="0" step="0.01" required />
              </div>
              <div className="form-group">
                <label>Supplier *</label>
                {(() => {
                  const selectedProduct = products.find(p => p.id.toString() === restockData.product_id);
                  const filteredSuppliers = getFilteredSuppliers();
                  
                  if (!restockData.product_id) {
                    return (
                      <input 
                        type="text" 
                        value="Select a product first" 
                        disabled 
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
                      />
                    );
                  }
                  
                  if (filteredSuppliers.length === 0) {
                    return (
                      <input 
                        type="text" 
                        value="No suppliers found for this product type" 
                        disabled 
                        style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} 
                      />
                    );
                  }
                  
                  return (
                    <Select
                      isClearable
                      isSearchable
                      placeholder={`Search from ${filteredSuppliers.length} suppliers...`}
                      value={restockData.supplier ? { label: restockData.supplier, value: restockData.supplier } : null}
                      onChange={option => handleRestockChange({ target: { name: 'supplier', value: option ? option.value : '' } })}
                      options={[
                        ...filteredSuppliers.map(s => ({ 
                          label: `${s.name}${s.company ? ' (' + s.company + ')' : ''}${s.specialty ? ' - ' + s.specialty : ''}`, 
                          value: s.name 
                        })),
                        { label: 'Not decided yet', value: 'Not decided yet' }
                      ]}
                      formatCreateLabel={inputValue => `Add new supplier: "${inputValue}"`}
                      styles={{ 
                        menu: base => ({ ...base, zIndex: 9999 }),
                        menuList: base => ({ ...base, maxHeight: '200px' }),
                        option: (base, state) => ({
                          ...base,
                          fontSize: '14px',
                          padding: '8px 12px'
                        })
                      }}
                      filterOption={(option, inputValue) => {
                        const searchIn = option.label.toLowerCase();
                        const searchFor = inputValue.toLowerCase();
                        return searchIn.includes(searchFor);
                      }}
                      noOptionsMessage={({ inputValue }) => 
                        inputValue ? `No suppliers found matching "${inputValue}"` : 'No suppliers available'
                      }
                    />
                  );
                })()}
              </div>
              <div className="form-group">
                <label>Warehouse *</label>
                <select name="location" value={restockData.location} onChange={handleRestockChange} required>
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        )}
    </div>
  );
});

export default AddMaterial;