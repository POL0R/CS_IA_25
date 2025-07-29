import "mapbox-gl/dist/mapbox-gl.css";
import React, { useState, useEffect, useRef } from "react";
import "./Customers.css";
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [showEditSupplier, setShowEditSupplier] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [products, setProducts] = useState([]);
  // Supplier performance state
  const [performance, setPerformance] = useState(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState(null);
  const [materialsBySupplier, setMaterialsBySupplier] = useState({});
  const [showMaterialsFor, setShowMaterialsFor] = useState(null);
  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user && user.role === 'admin';

  useEffect(() => {
    fetchSuppliers();
    fetchFinishedProducts();
    fetch("http://localhost:5001/suppliers/performance")
      .then(res => res.json())
      .then(data => { setPerformance(data); setPerfLoading(false); })
      .catch(() => { setPerfError("Could not load performance data"); setPerfLoading(false); });
  }, []);

  const fetchSuppliers = () => {
    fetch("http://localhost:5001/suppliers")
      .then(res => res.json())
      .then(data => setSuppliers(data))
      .catch(() => setSuppliers([]));
  };

  const fetchFinishedProducts = () => {
    fetch("http://localhost:5001/finished_products")
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data.map(fp => ({ id: fp.id, name: fp.model_name })) : []))
      .catch(() => setProducts([]));
  };

  const handleCreateSupplier = (supplierData) => {
    fetch("http://localhost:5001/suppliers", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supplierData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchSuppliers();
        setShowCreateSupplier(false);
      } else {
        alert('Error: ' + (data.error || 'Failed to create supplier'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleUpdateSupplier = (supplierId, supplierData) => {
    fetch(`http://localhost:5001/suppliers/${supplierId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(supplierData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchSuppliers();
        setShowEditSupplier(false);
        setSelectedSupplier(null);
      } else {
        alert('Error: ' + (data.error || 'Failed to update supplier'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleEditSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setShowEditSupplier(true);
  };

  // Admin actions
  const handleDeleteSupplier = (supplierId) => {
    if (!window.confirm("Are you sure you want to delete this supplier? This cannot be undone.")) return;
    fetch(`http://localhost:5001/suppliers/${supplierId}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        if (data.success) fetchSuppliers();
        else alert('Error: ' + (data.error || 'Failed to delete supplier'));
      })
      .catch(() => alert('Error: Could not delete supplier'));
  };
  const handleFlagSpam = (supplierId) => {
    if (!window.confirm("Flag this supplier as spam?")) return;
    fetch(`http://localhost:5001/suppliers/${supplierId}/flag_spam`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) fetchSuppliers();
        else alert('Error: ' + (data.error || 'Failed to flag as spam'));
      })
      .catch(() => alert('Error: Could not flag as spam'));
  };
  const handleBanSupplier = (supplierId) => {
    if (!window.confirm("Ban this supplier's email and delete their account? This cannot be undone.")) return;
    fetch(`http://localhost:5001/suppliers/${supplierId}/ban`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) fetchSuppliers();
        else alert('Error: ' + (data.error || 'Failed to ban supplier'));
      })
      .catch(() => alert('Error: Could not ban supplier'));
  };

  const handleViewMaterials = (supplierId) => {
    if (materialsBySupplier[supplierId]) {
      setShowMaterialsFor(supplierId === showMaterialsFor ? null : supplierId);
      return;
    }
    fetch(`http://localhost:5001/supplier-products/${supplierId}`)
      .then(res => res.json())
      .then(data => {
        setMaterialsBySupplier(prev => ({ ...prev, [supplierId]: data }));
        setShowMaterialsFor(supplierId);
      });
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    return supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
           (supplier.company && supplier.company.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="customers-container">
      {/* Header */}
      <div className="customers-header">
        <div className="header-left">
          <h1 className="page-title">Supplier Management</h1>
          <p className="page-subtitle">Manage supplier information, contact details, and company data</p>
        </div>
        <div className="header-actions">
          <button 
            className="action-btn create-customer"
            onClick={() => setShowCreateSupplier(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add Supplier
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="Search suppliers by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="customers-grid">
        {filteredSuppliers.map(supplier => (
          <div key={supplier.id} className="customer-card">
            <div className="customer-header">
              <div className="customer-avatar">
                {supplier.name.charAt(0).toUpperCase()}
              </div>
              <div className="customer-info">
                <h3 className="customer-name">{supplier.name}</h3>
                <p className="customer-company">{supplier.company || 'No Company'}</p>
              </div>
              <button 
                className="btn-edit"
                onClick={() => handleEditSupplier(supplier)}
                title="Edit Supplier"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
             {isAdmin && (
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
                 <button className="btn-admin-action" style={{ color: '#e74c3c', fontWeight: 600 }} onClick={() => handleDeleteSupplier(supplier.id)}>Delete</button>
                 <button className="btn-admin-action" style={{ color: '#f39c12', fontWeight: 600 }} onClick={() => handleFlagSpam(supplier.id)} disabled={supplier.is_spam}>Flag Spam</button>
                 <button className="btn-admin-action" style={{ color: '#b91c1c', fontWeight: 600 }} onClick={() => handleBanSupplier(supplier.id)} disabled={supplier.banned_email}>Ban Email</button>
               </div>
             )}
            </div>
            
            <div className="customer-details">
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{supplier.email || 'No email'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Phone:</span>
                <span className="detail-value">{supplier.phone || 'No phone'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tax ID:</span>
                <span className="detail-value">{supplier.tax_id || 'No tax ID'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Company:</span>
                <span className="detail-value">{supplier.company || 'No company'}</span>
              </div>
              {supplier.address && (
                <div className="detail-item full-width">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value">{supplier.address}</span>
                </div>
              )}
              {isAdmin && (
                <div className="detail-item full-width">
                  <span className="detail-label">Spam/Ban Status:</span>
                  <span className="detail-value">
                    {supplier.is_spam ? 'Spam' : 'Not spam'} | {supplier.banned_email ? 'Banned' : 'Not banned'}
                  </span>
                </div>
              )}
            </div>
            
            <div className="customer-footer">
              <span className="created-date">
                Created: {formatDate(supplier.created_at)}
              </span>
            </div>
            <button
              className="btn-admin-action"
              style={{ color: '#2563eb', fontWeight: 600, marginTop: 8 }}
              onClick={() => handleViewMaterials(supplier.id)}
            >
              {showMaterialsFor === supplier.id ? 'Hide Materials' : 'View Materials'}
            </button>
            {showMaterialsFor === supplier.id && (
              <div style={{ marginTop: 12, background: '#f7fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: 0, marginBottom: 8, color: '#222' }}>Supplied Materials</h4>
                {materialsBySupplier[supplier.id] && materialsBySupplier[supplier.id].length > 0 ? (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {materialsBySupplier[supplier.id].map(mat => (
                      <li key={mat.product_id} style={{ marginBottom: 6 }}>
                        <b>{mat.product_name}</b> ({mat.product_category || 'Uncategorized'}) — Price: <b>{mat.unit_price}</b> per {mat.product_unit}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: '#888', fontStyle: 'italic' }}>No materials found for this supplier.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Supplier Performance Evaluation Section */}
      <div style={{ margin: '48px 0 0 0', padding: '32px 0', borderTop: '2px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#3730a3', marginBottom: 18 }}>Supplier Performance Evaluation</h2>
        {perfLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>Loading performance data...</div>
        ) : perfError ? (
          <div style={{ color: 'red', textAlign: 'center', padding: 24 }}>{perfError}</div>
        ) : performance && Array.isArray(performance) && performance.length > 0 ? (
          <div>
            {performance.map((product, pidx) => (
              <div key={product.product_id} style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#222', marginBottom: 10 }}>
                  {product.product_name} <span style={{ color: '#888', fontSize: 16 }}>({product.product_sku})</span>
                </div>
                {product.suppliers && product.suppliers.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 28 }}>
                    {product.suppliers.map((s, idx) => {
                      const scoreClass = s.score >= 8 ? 'good' : s.score >= 6 ? 'warning' : 'poor';
                      return (
                        <div key={s.name} style={{
                          border: '1.5px solid #e5e7eb',
                          borderRadius: 12,
                          background: idx === 0 ? 'linear-gradient(135deg, #d5e6f8 0%, #f8f9fa 100%)' : idx === 1 ? 'linear-gradient(135deg, #fdeaa7 0%, #f8f9fa 100%)' : idx === 2 ? 'linear-gradient(135deg, #fadbd8 0%, #f8f9fa 100%)' : '#fff',
                          boxShadow: '0 2px 8px rgba(60,60,120,0.07)',
                          padding: 28,
                          position: 'relative',
                          minHeight: 260,
                          marginBottom: 12,
                        }}>
                          <div style={{ position: 'absolute', top: -16, left: -16, width: 38, height: 38, borderRadius: '50%', background: idx === 0 ? '#27ae60' : idx === 1 ? '#f39c12' : '#e74c3c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, boxShadow: '0 2px 8px rgba(60,60,120,0.10)' }}>{idx + 1}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#239b56', marginBottom: 10 }}>{s.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 10 }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 600 }}>₹{s.avg_price}</div>
                              <div style={{ fontSize: 12, color: '#7f8c8d', textTransform: 'uppercase' }}>Avg Price</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 600, color: s.score >= 8 ? '#27ae60' : s.score >= 6 ? '#f39c12' : '#e74c3c' }}>{s.on_time_rate}%</div>
                              <div style={{ fontSize: 12, color: '#7f8c8d', textTransform: 'uppercase' }}>On-time Rate</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 600, color: s.score >= 8 ? '#27ae60' : s.score >= 6 ? '#f39c12' : '#e74c3c' }}>{s.rejection_rate}%</div>
                              <div style={{ fontSize: 12, color: '#7f8c8d', textTransform: 'uppercase' }}>Rejection Rate</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 18, fontWeight: 600 }}>{s.avg_lead_time} days</div>
                              <div style={{ fontSize: 12, color: '#7f8c8d', textTransform: 'uppercase' }}>Avg Lead Time</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginTop: 16, padding: 10, background: '#34495e', color: '#fff', borderRadius: 6 }}>Score: {s.score}/10</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#888', fontStyle: 'italic', margin: '16px 0 32px 0' }}>No supplier performance data for this product.</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 24 }}>No performance data available.</div>
        )}
      </div>

      {/* Create Supplier Modal */}
      {showCreateSupplier && (
        <SupplierForm
          products={products}
          onSubmit={handleCreateSupplier}
          onCancel={() => setShowCreateSupplier(false)}
        />
      )}

      {/* Edit Supplier Modal */}
      {showEditSupplier && selectedSupplier && (
        <SupplierForm
          supplier={selectedSupplier}
          onSubmit={handleUpdateSupplier}
          onCancel={() => {
            setShowEditSupplier(false);
            setSelectedSupplier(null);
          }}
        />
      )}
    </div>
  );
}

function SupplierForm({ supplier, onSubmit, onCancel, products: parentProducts }) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    company: supplier?.company || '',
    tax_id: supplier?.tax_id || ''
  });
  const [products, setProducts] = useState(parentProducts || []);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [distances, setDistances] = useState({});
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState("");
  const [location, setLocation] = useState({
    lng: null,
    lat: null,
    address: supplier?.address || ''
  });
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (parentProducts) {
      setProducts(parentProducts);
      if (supplier) {
        setSelectedProducts(parentProducts.filter(p => p.supplier === supplier.name).map(p => p.id));
      }
    } else {
      fetchFinishedProducts()
        .then(data => {
          setProducts(data);
          if (supplier) {
            setSelectedProducts(data.filter(p => p.supplier === supplier.name).map(p => p.id));
          }
        });
    }
  }, [parentProducts, supplier]);

  useEffect(() => {
    fetch("http://localhost:5001/warehouses")
      .then(res => res.json())
      .then(data => setWarehouses(data));
  }, []);

  // Initialize map and geocoder
  useEffect(() => {
    if (!mapboxToken || !mapContainer.current) return;
    if (mapRef.current) return; // Only initialize once
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [77.209, 28.6139], // Default to Delhi
      zoom: 4
    });
    mapRef.current = map;
    // Add geocoder
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Search supplier location...'
    });
    map.addControl(geocoder);
    // On result, update marker and location
    geocoder.on('result', (e) => {
      const { center, place_name } = e.result;
      setLocation({ lng: center[0], lat: center[1], address: place_name });
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.flyTo({ center, zoom: 12 });
    });
    // Allow click to set marker
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setLocation(loc => ({ ...loc, lng, lat }));
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
      // Reverse geocode to get address
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`)
        .then(res => res.json())
        .then(data => {
          const place = data.features[0]?.place_name || '';
          setLocation(loc => ({ ...loc, address: place }));
        });
    });
    // If editing, set marker
    if (supplier?.address && supplier?.lat && supplier?.lng) {
      const center = [supplier.lng, supplier.lat];
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.setCenter(center);
      map.setZoom(12);
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, supplier]);

  // Update formData.address when location.address changes
  useEffect(() => {
    setFormData(f => ({ ...f, address: location.address }));
  }, [location.address]);

  useEffect(() => {
    if (!location.lng || !location.lat || !warehouses.length || !mapboxToken) return;
    setDistanceLoading(true);
    setDistanceError("");
    setDistances({});
    const geocodingClient = mbxGeocoding({ accessToken: mapboxToken });
    const directionsClient = mbxDirections({ accessToken: mapboxToken });
    // Use coordinates directly for supplier
    const supplierCoord = [location.lng, location.lat];
    Promise.all(warehouses.map(wh =>
      geocodingClient.forwardGeocode({ query: wh.location, limit: 1 }).send()
        .then(whRes => {
          const whCoord = whRes.body.features[0]?.center;
          if (!whCoord) return { name: wh.name, distance: null, error: true };
          return directionsClient.getDirections({
            profile: 'driving',
            waypoints: [
              { coordinates: supplierCoord },
              { coordinates: whCoord }
            ]
          }).send().then(dirRes => {
            const route = dirRes.body.routes[0];
            return { name: wh.name, distance: route ? (route.distance / 1000) : null, error: !route };
          }).catch(() => ({ name: wh.name, distance: null, error: true }));
        })
        .catch(() => ({ name: wh.name, distance: null, error: true }))
    )).then(results => {
      const distObj = {};
      let anyError = false;
      results.forEach(r => {
        if (r) {
          distObj[r.name] = r.error ? null : r.distance;
          if (r.error) anyError = true;
        }
      });
      setDistances(distObj);
      setDistanceLoading(false);
      if (anyError) setDistanceError("Some distances could not be calculated.");
    });
  }, [location.lng, location.lat, warehouses, mapboxToken]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a supplier name');
      return;
    }
    if (!formData.email.trim()) {
      alert('Please enter a supplier email');
      return;
    }
    // Update products' supplier field
    Promise.all(selectedProducts.map(productId =>
      fetch(`http://localhost:5001/finished_products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier: formData.name })
      })
    )).then(() => {
      if (supplier) {
        onSubmit(supplier.id, formData);
      } else {
        onSubmit(formData);
      }
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleProductsChange = (e) => {
    const options = Array.from(e.target.selectedOptions);
    setSelectedProducts(options.map(opt => parseInt(opt.value)));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Supplier name"
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="supplier@example.com"
                />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Company name"
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1234567890"
                />
              </div>
              <div className="form-group">
                <label>Tax ID</label>
                <input
                  type="text"
                  name="tax_id"
                  value={formData.tax_id}
                  onChange={handleChange}
                  placeholder="Tax identification number"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Location *</label>
              <div ref={mapContainer} style={{ width: '100%', height: 300, borderRadius: 8, marginBottom: 8 }} />
              {location.address && (
                <div style={{ marginTop: 8, fontSize: 14, color: '#333' }}>
                  <b>Selected Address:</b> {location.address}
                </div>
              )}
              {distanceLoading && (
                <div className="distance-info">Calculating distances...</div>
              )}
              {distanceError && (
                <div className="distance-info error">{distanceError}</div>
              )}
              {!distanceLoading && !distanceError && Object.keys(distances).length > 0 && (
                <div className="distance-info">
                  {Object.entries(distances).map(([name, dist]) => (
                    <div key={name}>
                      Distance to {name}: {dist != null ? `${dist.toFixed(2)} km` : 'N/A'}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Assign Products</label>
              <div className="checkbox-list">
                {products.map(product => (
                  <label key={product.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      value={product.id}
                      checked={selectedProducts.includes(product.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedProducts(prev => [...prev, product.id]);
                        } else {
                          setSelectedProducts(prev => prev.filter(id => id !== product.id));
                        }
                      }}
                    />
                    <span className="custom-checkbox"></span>
                    {product.name} ({product.sku})
                  </label>
                ))}
              </div>
              <small>Select products to assign to this supplier</small>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              {supplier ? 'Update Supplier' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 