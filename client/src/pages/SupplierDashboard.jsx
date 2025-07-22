import React, { useEffect, useState, useRef } from "react";
import mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import './SupplierOnboarding.css';
import { FaMapMarkerAlt, FaBox, FaPlus, FaEdit, FaTrash, FaChartLine, FaTruck, FaWarehouse, FaUser, FaPhone, FaEnvelope, FaBuilding, FaIdCard, FaGlobe, FaStar, FaCheckCircle, FaExclamationTriangle, FaEye, FaFileInvoice } from 'react-icons/fa';
import { FiUser, FiPackage, FiTrendingUp, FiDollarSign, FiShoppingCart } from 'react-icons/fi';
import SupplierWarehouseRequests from './SupplierWarehouseRequests';

const REQUIRED_FIELDS = ["name", "email", "phone", "address", "company", "tax_id"];

// Add at the top:
// Fetch master product catalog for selection
function useMasterProducts() {
  const [masterProducts, setMasterProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("http://localhost:5001/master-products")
      .then(res => res.json())
      .then(data => {
        setMasterProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setMasterProducts([]);
        setLoading(false);
      });
  }, []);
  return { masterProducts, loading };
}

// Fetch supplier's products from SupplierProduct table
function useSupplierProducts(supplierId) {
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supplierId) {
      setSupplierProducts([]);
      setLoading(false);
      return;
    }
    fetch(`http://localhost:5001/supplier-products/${supplierId}`)
      .then(res => res.json())
      .then(data => {
        setSupplierProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setSupplierProducts([]);
        setLoading(false);
      });
  }, [supplierId]);
  return { supplierProducts, loading };
}

function ProductSelectBox({ selected, setSelected }) {
  const { masterProducts, loading } = useMasterProducts();
  const [search, setSearch] = useState("");

  const filtered = masterProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = prod => {
    if (selected.find(s => s.id === prod.id)) return;
    setSelected([...selected, { 
      ...prod, 
      current_stock: 0, 
      unit_price: 0
    }]);
  };
  
  const handleRemove = idx => {
    setSelected(selected.filter((_, i) => i !== idx));
  };
  
  const handleStockChange = (idx, field, value) => {
    setSelected(sel => sel.map((item, i) => 
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  return (
    <div className="product-dropbox-section">
      <div className="product-dropbox-title">Select Products from Master Catalog</div>
      <input
        className="onboarding-input"
        placeholder="Search products..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12, width: "100%" }}
      />
      <div className="product-select-list" style={{ maxHeight: 200, overflowY: "auto", width: "100%", marginBottom: 12 }}>
        {loading ? <div>Loading master catalog...</div> : filtered.map(prod => (
          <div key={prod.id} className="product-list-item" style={{ cursor: "pointer" }} onClick={() => handleSelect(prod)}>
            {prod.photo_url && <img src={prod.photo_url} alt="" className="product-list-photo" />}
            <div className="product-list-info">
              <div className="product-list-name">{prod.name}</div>
              <div className="product-list-category">{prod.category}</div>
            </div>
            <div style={{ marginLeft: "auto", color: "#6a6a8a", fontWeight: 500 }}>Select</div>
          </div>
        ))}
      </div>
      <div className="product-list">
        {selected.map((p, idx) => (
          <div className="product-list-item" key={p.id}>
            {p.photo_url && <img src={p.photo_url} alt="" className="product-list-photo" />}
            <div className="product-list-info">
              <div className="product-list-name">{p.name}</div>
              <div className="product-list-category">{p.category}</div>
            </div>
            <div className="product-stock-inputs">
              <input
                type="number"
                placeholder="Stock"
                value={p.current_stock || 0}
                onChange={e => handleStockChange(idx, 'current_stock', parseFloat(e.target.value) || 0)}
                className="stock-input"
              />
              <input
                type="number"
                placeholder="Price"
                value={p.unit_price || 0}
                onChange={e => handleStockChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                className="stock-input"
              />

            </div>
            <button className="product-list-remove" onClick={() => handleRemove(idx)}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SupplierDashboard({ user }) {
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    name: user?.username || "",
    email: user?.email || "",
    phone: "",
    address: "",
    company: "",
    tax_id: "",
    lat: null,
    lng: null,
    products: [] // Add products to onboardingData
  });
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ 
    product_id: "", 
    current_stock: 0, 
    unit_price: 0
  });
  const [productError, setProductError] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [distances, setDistances] = useState({});
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState("");
  const [closestWarehouse, setClosestWarehouse] = useState(null);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [editProfile, setEditProfile] = useState(false);
  const [editData, setEditData] = useState({
    name: user?.username || "",
    email: user?.email || "",
    phone: "",
    address: "",
    company: "",
    tax_id: "",
    lat: null,
    lng: null,
    products: []
  });
  const isProfileComplete = supplier && REQUIRED_FIELDS.every(f => supplier[f] && String(supplier[f]).trim() !== "");

  // Use the new hook for supplier products
  const { supplierProducts, loading: supplierProductsLoading } = useSupplierProducts(supplier?.id);
  const { masterProducts } = useMasterProducts();
  
  // State for supplier requests
  const [supplierRequests, setSupplierRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProductDropdown && !event.target.closest('.searchable-select')) {
        setShowProductDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProductDropdown]);

  // Fetch warehouses for distance calculation
  useEffect(() => {
    fetch("http://localhost:5001/warehouses")
      .then(res => res.json())
      .then(data => setWarehouses(data))
      .catch(() => setWarehouses([]));
  }, []);

  // Fetch supplier requests
  useEffect(() => {
    if (!supplier?.id) return;
    setRequestsLoading(true);
    fetch(`http://localhost:5001/supplier-requests/supplier/${supplier.id}`)
      .then(res => res.json())
      .then(data => {
        setSupplierRequests(data);
        setRequestsLoading(false);
      })
      .catch(() => {
        setSupplierRequests([]);
        setRequestsLoading(false);
      });
  }, [supplier?.id]);

  // Fetch supplier profile by email
  useEffect(() => {
    if (!user || !user.email) return;
    setLoading(true);
    fetch("http://localhost:5001/suppliers")
      .then(res => res.json())
      .then(data => {
        const found = data.find(s => s.email === user.email);
        setSupplier(found || null);
        setShowOnboarding(!found);
        setLoading(false);
        if (found) {
          setEditData(prev => ({ ...prev, products: found.products || [] }));
        }
      })
      .catch(() => {
        setError("Could not load supplier profile.");
        setLoading(false);
      });
  }, [user]);

  // Mapbox for onboarding address
  useEffect(() => {
    if (!showOnboarding && !(editProfile && !isProfileComplete)) return;
    if (!mapboxToken || !mapContainer.current) return;
    if (mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [77.209, 28.6139],
      zoom: 4
    });
    mapRef.current = map;
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: 'Search supplier location...'
    });
    map.addControl(geocoder);
    geocoder.on('result', (e) => {
      const { center, place_name } = e.result;
      if (showOnboarding) {
        setOnboardingData(d => ({ ...d, address: place_name, lng: center[0], lat: center[1] }));
      } else if (editProfile && !isProfileComplete) {
        setEditData(d => ({ ...d, address: place_name, lng: center[0], lat: center[1] }));
      }
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat(center).addTo(map);
      map.flyTo({ center, zoom: 12 });
    });
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      if (showOnboarding) {
        setOnboardingData(d => ({ ...d, lng, lat }));
      } else if (editProfile && !isProfileComplete) {
        setEditData(d => ({ ...d, lng, lat }));
      }
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`)
        .then(res => res.json())
        .then(data => {
          const place = data.features[0]?.place_name || '';
          if (showOnboarding) {
            setOnboardingData(d => ({ ...d, address: place }));
          } else if (editProfile && !isProfileComplete) {
            setEditData(d => ({ ...d, address: place }));
          }
        });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [showOnboarding, editProfile, isProfileComplete, mapboxToken]);

  // Calculate distances to warehouses when lat/lng changes
  useEffect(() => {
    if (!onboardingData.lng || !onboardingData.lat || !warehouses.length || !mapboxToken) return;
    setDistanceLoading(true);
    setDistanceError("");
    setDistances({});
    const supplierCoord = [onboardingData.lng, onboardingData.lat];
    Promise.all(warehouses.map(wh => {
      if (!wh.lat || !wh.lng) return Promise.resolve({ name: wh.name, distance: null, error: true, id: wh.id });
      return fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${supplierCoord[0]},${supplierCoord[1]};${wh.lng},${wh.lat}?access_token=${mapboxToken}`)
        .then(res => res.json())
        .then(data => {
          const route = data.routes && data.routes[0];
          return { name: wh.name, distance: route ? (route.distance / 1000) : null, error: !route, id: wh.id };
        })
        .catch(() => ({ name: wh.name, distance: null, error: true, id: wh.id }));
    })).then(results => {
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
      // Find closest warehouse
      const valid = results.filter(r => !r.error && r.distance != null);
      if (valid.length) {
        valid.sort((a, b) => a.distance - b.distance);
        setClosestWarehouse({ name: valid[0].name, distance: valid[0].distance });
      } else {
        setClosestWarehouse(null);
      }
    });
  }, [onboardingData.lng, onboardingData.lat, warehouses, mapboxToken]);

  // Profile completion form (if supplier exists but incomplete)
  useEffect(() => {
    if (supplier && !isProfileComplete) {
      setEditProfile(true);
      setEditData({ ...supplier, products: supplier.products || [] }); // Populate products for editData
    } else {
      setEditProfile(false);
    }
  }, [supplier, isProfileComplete]);
  const handleEditChange = e => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };
  const handleEditSubmit = e => {
    e.preventDefault();
    fetch(`http://localhost:5001/suppliers/${supplier.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Refetch supplier profile
          fetch("http://localhost:5001/suppliers")
            .then(res => res.json())
            .then(data2 => {
              const found = data2.find(s => s.email === user.email);
              setSupplier(found || null);
            });
        } else {
          setError(data.error || "Failed to update profile");
        }
      })
      .catch(() => setError("Server error. Please try again later."));
  };

  // Product management handlers for new system
  const handleAddProductToShowcase = e => {
    e.preventDefault();
    if (!productForm.product_id) {
      setProductError("Please select a product from the master catalog");
      return;
    }
    setProductError("");
    setProductLoading(true);
    
    fetch("http://localhost:5001/supplier-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ...productForm, 
        supplier_id: supplier.id 
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Refetch supplier products
          window.location.reload(); // Simple refresh for now
          setShowAddProduct(false);
          setProductForm({ product_id: "", current_stock: 0, unit_price: 0 });
        } else {
          setProductError(data.error || "Failed to add product to showcase");
        }
        setProductLoading(false);
      })
      .catch(() => {
        setProductError("Server error. Please try again later.");
        setProductLoading(false);
      });
  };

  const handleUpdateStock = (supplierProductId, field, value) => {
    fetch(`http://localhost:5001/supplier-products/${supplierProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Refetch supplier products
          window.location.reload();
        } else {
          setProductError(data.error || "Failed to update stock");
        }
      })
      .catch(() => setProductError("Server error. Please try again later."));
  };

  const handleRemoveFromShowcase = supplierProductId => {
    if (!window.confirm("Are you sure you want to remove this product from your showcase?")) return;
    
    fetch(`http://localhost:5001/supplier-products/${supplierProductId}`, { 
      method: "DELETE" 
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          window.location.reload();
        } else {
          setProductError(data.error || "Failed to remove product");
        }
      })
      .catch(() => setProductError("Server error. Please try again later."));
  };

  // Supplier request handlers
  const viewRequestDetails = async (requestId) => {
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}`);
      const data = await response.json();
      // For now, just show an alert with request details
      alert(`Request Details:\nTitle: ${data.title}\nDescription: ${data.description}\nItems: ${data.items?.length || 0} items`);
    } catch (error) {
      setError('Failed to load request details');
    }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      const data = await response.json();
      if (data.success) {
        // Refetch requests
        fetch(`http://localhost:5001/supplier-requests/supplier/${supplier.id}`)
          .then(res => res.json())
          .then(data => setSupplierRequests(data))
          .catch(() => setSupplierRequests([]));
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (error) {
      setError('Failed to update status');
    }
  };

  // Onboarding form handlers
  const handleOnboardingChange = e => {
    setOnboardingData({ ...onboardingData, [e.target.name]: e.target.value });
  };
  const handleOnboardingSubmit = e => {
    e.preventDefault();
    // POST to /suppliers
    fetch("http://localhost:5001/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(onboardingData)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setShowOnboarding(false);
          // Refetch supplier profile
          fetch("http://localhost:5001/suppliers")
            .then(res => res.json())
            .then(data2 => {
              const found = data2.find(s => s.email === user.email);
              setSupplier(found || null);
            });
        } else {
          setError(data.error || "Failed to create supplier profile");
        }
      })
      .catch(() => setError("Server error. Please try again later."));
  };

  if (loading) return (
    <div className="dashboard-loading">
      <div className="loading-spinner"></div>
      <h2>Loading your dashboard...</h2>
    </div>
  );
  
  if (error) return (
    <div className="dashboard-error">
      <FaExclamationTriangle size={48} />
      <h2>Error</h2>
      <p>{error}</p>
    </div>
  );

  // Onboarding form (fullscreen, hide nav/sidebar)
  if (showOnboarding) {
    return (
      <div className="onboarding-bg-gradient">
        <div className="onboarding-card">
          <div className="onboarding-logo-row">
            <div className="onboarding-logo"><FiUser size={40} /></div>
            <div className="onboarding-step">Step 1 of 1: Complete Your Supplier Profile</div>
          </div>
          <h2 className="onboarding-title">Welcome! Let's set up your supplier profile</h2>
          {error && <div className="onboarding-banner-error">{error}</div>}
          <form className="onboarding-form" onSubmit={handleOnboardingSubmit} autoComplete="off">
            {REQUIRED_FIELDS.map(f => (
              <div key={f} className="onboarding-field-group">
                <label className={`onboarding-label${onboardingData[f] ? ' filled' : ''}`}>{f.replace('_', ' ').toUpperCase()}</label>
                {f === 'address' ? (
                  <>
                    <div className="onboarding-mapbox-row">
                      <FaMapMarkerAlt className="onboarding-map-icon" />
                      <div ref={mapContainer} className="onboarding-mapbox" />
                    </div>
                    {onboardingData.address && <div className="onboarding-address-info"><b>Selected Address:</b> {onboardingData.address}</div>}
                    {distanceLoading && <div className="onboarding-distance-loading">Calculating distances...</div>}
                    {distanceError && <div className="onboarding-banner-error">{distanceError}</div>}
                    {!distanceLoading && !distanceError && Object.keys(distances).length > 0 && (
                      <div className="onboarding-distance-box">
                        {Object.entries(distances).map(([name, dist]) => (
                          <div key={name}>
                            <span className="onboarding-warehouse-name">{name}:</span> {dist != null ? `${dist.toFixed(2)} km` : 'N/A'}
                          </div>
                        ))}
                      </div>
                    )}
                    {closestWarehouse && (
                      <div className="closest-warehouse-info">
                        Closest warehouse: <b>{closestWarehouse.name}</b> ({closestWarehouse.distance.toFixed(2)} km)
                      </div>
                    )}
                  </>
                ) : (
                  <input
                    className="onboarding-input"
                    type={f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text'}
                    name={f}
                    value={onboardingData[f] || ""}
                    onChange={handleOnboardingChange}
                    required
                  />
                )}
              </div>
            ))}
            <ProductSelectBox selected={onboardingData.products} setSelected={products => setOnboardingData({ ...onboardingData, products })} />
            <button type="submit" className="onboarding-submit-btn">Submit</button>
          </form>
        </div>
      </div>
    );
  }

  // Profile completion form (fullscreen, hide nav/sidebar)
  if (editProfile && !isProfileComplete) {
  return (
      <div className="onboarding-bg-gradient">
        <div className="onboarding-card">
          <div className="onboarding-logo-row">
            <div className="onboarding-logo"><FiUser size={40} /></div>
            <div className="onboarding-step">Step 1 of 1: Complete Your Supplier Profile</div>
          </div>
          <h2 className="onboarding-title">Complete Your Supplier Profile</h2>
          {error && <div className="onboarding-banner-error">{error}</div>}
          <form className="onboarding-form" onSubmit={handleEditSubmit} autoComplete="off">
            {REQUIRED_FIELDS.map(f => (
              <div key={f} className="onboarding-field-group">
                <label className={`onboarding-label${editData[f] ? ' filled' : ''}`}>{f.replace('_', ' ').toUpperCase()}</label>
                {f === 'address' ? (
                  <>
                    <div className="onboarding-mapbox-row">
                      <FaMapMarkerAlt className="onboarding-map-icon" />
                      <div ref={mapContainer} className="onboarding-mapbox" />
                    </div>
                    {editData.address && <div className="onboarding-address-info"><b>Selected Address:</b> {editData.address}</div>}
                    {distanceLoading && <div className="onboarding-distance-loading">Calculating distances...</div>}
                    {distanceError && <div className="onboarding-banner-error">{distanceError}</div>}
                    {!distanceLoading && !distanceError && Object.keys(distances).length > 0 && (
                      <div className="onboarding-distance-box">
                        {Object.entries(distances).map(([name, dist]) => (
                          <div key={name}>
                            <span className="onboarding-warehouse-name">{name}:</span> {dist != null ? `${dist.toFixed(2)} km` : 'N/A'}
                          </div>
                        ))}
                      </div>
                    )}
                    {closestWarehouse && (
                      <div className="closest-warehouse-info">
                        Closest warehouse: <b>{closestWarehouse.name}</b> ({closestWarehouse.distance.toFixed(2)} km)
                      </div>
                    )}
                  </>
                ) : (
                  <input
                    className="onboarding-input"
                    type={f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text'}
                    name={f}
                    value={editData[f] || ""}
                    onChange={handleEditChange}
                    required
                  />
                )}
              </div>
            ))}
            <ProductSelectBox selected={editData.products} setSelected={products => setEditData({ ...editData, products })} />
            <button type="submit" className="onboarding-submit-btn">Update</button>
          </form>
        </div>
      </div>
    );
  }

  // Calculate dashboard stats from supplier products
  const totalProducts = Array.isArray(supplierProducts) ? supplierProducts.length : 0;
  const totalValue = Array.isArray(supplierProducts) ? supplierProducts.reduce((sum, p) => sum + (p.current_stock * p.unit_price), 0) : 0;
  const outOfStockProducts = Array.isArray(supplierProducts) ? supplierProducts.filter(p => p.current_stock <= 0).length : 0;
  const categories = Array.isArray(supplierProducts) ? [...new Set(supplierProducts.map(p => p.product_category))].length : 0;

  // Main dashboard: show supplier products
  return (
    <div className="supplier-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="dashboard-title">Supplier Dashboard</h1>
            <p className="dashboard-subtitle">Welcome back, {supplier?.name || user?.username}</p>
          </div>
          <div className="header-right">
            <div className="profile-status">
              {isProfileComplete ? (
                <div className="status-complete">
                  <FaCheckCircle />
                  <span>Profile Complete</span>
                </div>
              ) : (
                <div className="status-incomplete">
                  <FaExclamationTriangle />
                  <span>Profile Incomplete</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FiPackage />
          </div>
          <div className="stat-content">
            <h3 className="stat-number">{totalProducts}</h3>
            <p className="stat-label">Products in Showcase</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FiDollarSign />
          </div>
          <div className="stat-content">
            <h3 className="stat-number">${totalValue.toLocaleString()}</h3>
            <p className="stat-label">Total Inventory Value</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <h3 className="stat-number">{outOfStockProducts}</h3>
            <p className="stat-label">Out of Stock Items</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp />
          </div>
          <div className="stat-content">
            <h3 className="stat-number">{categories}</h3>
            <p className="stat-label">Product Categories</p>
          </div>
        </div>
      </div>

      {/* Supplier Info Card */}
      <div className="supplier-info-section">
        <div className="info-card">
          <div className="card-header">
            <h2>Company Information</h2>
            <button className="edit-btn" onClick={() => setEditProfile(true)}>
              <FaEdit />
              Edit Profile
            </button>
          </div>
          <div className="info-grid">
            <div className="info-item">
              <FaUser className="info-icon" />
              <div className="info-content">
                <label>Contact Person</label>
                <span>{supplier?.name || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item">
              <FaEnvelope className="info-icon" />
              <div className="info-content">
                <label>Email</label>
                <span>{supplier?.email || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item">
              <FaPhone className="info-icon" />
              <div className="info-content">
                <label>Phone</label>
                <span>{supplier?.phone || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item">
              <FaBuilding className="info-icon" />
              <div className="info-content">
                <label>Company</label>
                <span>{supplier?.company || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item">
              <FaIdCard className="info-icon" />
              <div className="info-content">
                <label>Tax ID</label>
                <span>{supplier?.tax_id || 'Not provided'}</span>
              </div>
            </div>
            <div className="info-item">
              <FaGlobe className="info-icon" />
              <div className="info-content">
                <label>Address</label>
                <span>{supplier?.address || 'Not provided'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="products-section">
        <div className="section-header">
          <h2>My Product Showcase</h2>
          <button 
            className="add-product-btn"
            onClick={() => setShowAddProduct(true)}
          >
            <FaPlus />
            Add Product to Showcase
          </button>
        </div>

        {/* Add Product Modal */}
        {showAddProduct && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Product to Showcase</h3>
                <button 
                  className="close-btn"
                  onClick={() => {
                    setShowAddProduct(false);
                    setProductForm({ product_id: "", current_stock: 0, unit_price: 0 });
                    setProductError("");
                    setProductSearch("");
                    setShowProductDropdown(false);
                  }}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleAddProductToShowcase} className="product-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Select Product *</label>
                    <div className="searchable-select">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={e => {
                          setProductSearch(e.target.value);
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        className="search-input"
                        required={!productForm.product_id}
                      />
                      {showProductDropdown && (
                        <div className="search-dropdown">
                          {masterProducts
                            .filter(product => 
                              product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                              product.category.toLowerCase().includes(productSearch.toLowerCase()) ||
                              product.sku.toLowerCase().includes(productSearch.toLowerCase())
                            )
                            .map(product => (
                              <div
                                key={product.id}
                                className="search-option"
                                onClick={() => {
                                  setProductForm({...productForm, product_id: product.id});
                                  setProductSearch(product.name);
                                  setShowProductDropdown(false);
                                }}
                              >
                                <div className="option-info">
                                  <div className="option-name">{product.name}</div>
                                  <div className="option-category">{product.category} • {product.sku}</div>
                                </div>
                              </div>
                            ))}
                          {masterProducts.filter(product => 
                            product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            product.category.toLowerCase().includes(productSearch.toLowerCase()) ||
                            product.sku.toLowerCase().includes(productSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="no-results">No products found</div>
                          )}
                        </div>
                      )}
                      {productForm.product_id && (
                        <div className="selected-product">
                          Selected: {masterProducts.find(p => p.id == productForm.product_id)?.name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Current Stock *</label>
                    <input 
                      type="number" 
                      name="current_stock" 
                      value={productForm.current_stock} 
                      onChange={e => setProductForm({...productForm, current_stock: parseFloat(e.target.value) || 0})} 
                      required 
                      min="0" 
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit Price *</label>
                    <input 
                      type="number" 
                      name="unit_price" 
                      value={productForm.unit_price} 
                      onChange={e => setProductForm({...productForm, unit_price: parseFloat(e.target.value) || 0})} 
                      required 
                      min="0" 
                      step="0.01" 
                    />
                  </div>

                </div>
                {productError && <div className="error-message">{productError}</div>}
                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => {
                      setShowAddProduct(false);
                      setProductForm({ product_id: "", current_stock: 0, unit_price: 0 });
                      setProductError("");
                      setProductSearch("");
                      setShowProductDropdown(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit" 
                    className="submit-btn"
                    disabled={productLoading}
                  >
                    {productLoading ? "Adding..." : "Add to Showcase"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Products Grid */}
        {supplierProductsLoading ? (
          <div className="empty-state">
            <div className="loading-spinner"></div>
            <h3>Loading your products...</h3>
          </div>
        ) : supplierProducts.length === 0 ? (
          <div className="empty-state">
            <FiPackage size={64} />
            <h3>No products in showcase yet</h3>
            <p>Start by adding products from the master catalog to your showcase</p>
            <button 
              className="primary-btn"
              onClick={() => setShowAddProduct(true)}
            >
              <FaPlus />
              Add Your First Product
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {supplierProducts.map(supplierProduct => (
              <div key={supplierProduct.id} className="product-card">
                <div className="product-header">
                  <h3 className="product-name">{supplierProduct.product_name}</h3>
                  <div className="product-actions">
                    <button 
                      className="action-btn delete"
                      onClick={() => handleRemoveFromShowcase(supplierProduct.id)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
                <div className="product-details">
                  <div className="detail-row">
                    <span className="detail-label">SKU:</span>
                    <span className="detail-value">{supplierProduct.product_sku}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Category:</span>
                    <span className="detail-value">{supplierProduct.product_category}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Current Stock:</span>
                    <input
                      type="number"
                      value={supplierProduct.current_stock}
                      onChange={e => handleUpdateStock(supplierProduct.id, 'current_stock', parseFloat(e.target.value) || 0)}
                      className="stock-input-inline"
                    />
                    <span className="detail-value">{supplierProduct.product_unit}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Unit Price:</span>
                    <input
                      type="number"
                      value={supplierProduct.unit_price}
                      onChange={e => handleUpdateStock(supplierProduct.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="stock-input-inline"
                    />
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Total Value:</span>
                    <span className="detail-value">${(supplierProduct.current_stock * supplierProduct.unit_price).toLocaleString()}</span>
                  </div>

                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Supplier Requests Section */}
      <div className="requests-section">
        <div className="section-header">
          <h2>Incoming Requests</h2>
        </div>

        {requestsLoading ? (
          <div className="empty-state">
            <div className="loading-spinner"></div>
            <h3>Loading requests...</h3>
          </div>
        ) : supplierRequests.length === 0 ? (
          <div className="empty-state">
            <FaBox size={64} />
            <h3>No incoming requests</h3>
            <p>Requests from admin/project managers will appear here</p>
          </div>
        ) : (
          <div className="requests-grid">
            {supplierRequests.map(request => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <div className="request-info">
                    <h3>{request.title}</h3>
                    <p className="request-number">{request.request_number}</p>
                  </div>
                  <div className={`request-status status-${request.status}`}>
                    {request.status.replace('_', ' ').toUpperCase()}
                  </div>
                </div>

                <div className="request-details">
                  <div className="detail-row">
                    <span className="detail-label">From:</span>
                    <span className="detail-value">{request.requester_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Project:</span>
                    <span className="detail-value">{request.project_name || 'General'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Priority:</span>
                    <span className={`priority-${request.priority}`}>{request.priority}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Expected Delivery:</span>
                    <span className="detail-value">
                      {request.expected_delivery_date ? new Date(request.expected_delivery_date).toLocaleDateString() : 'Not set'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Total Amount:</span>
                    <span className="detail-value amount">${request.total_amount?.toLocaleString() || '0'}</span>
                  </div>
                </div>

                <div className="request-actions">
                  <button 
                    className="action-btn view"
                    onClick={() => viewRequestDetails(request.id)}
                  >
                    <FaEye />
                    View Details
                  </button>
                  {request.status === 'sent' && (
                    <button 
                      className="action-btn review"
                      onClick={() => updateRequestStatus(request.id, 'supplier_reviewing')}
                    >
                      <FaEdit />
                      Start Review
                    </button>
                  )}
                  {request.status === 'supplier_reviewing' && (
                    <button 
                      className="action-btn quote"
                      onClick={() => updateRequestStatus(request.id, 'supplier_quoted')}
                    >
                      <FaFileInvoice />
                      Send Quote
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warehouse-Based Requests Section */}
      <div className="warehouse-requests-section">
        <div className="section-header">
          <h2>Warehouse-Based Requests</h2>
          <p>View and respond to requests from nearby warehouses</p>
        </div>
        <SupplierWarehouseRequests user={user} />
      </div>
    </div>
  );
} 