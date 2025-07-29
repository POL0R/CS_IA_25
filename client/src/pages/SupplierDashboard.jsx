import React, { useEffect, useState } from 'react';
import './SupplierDashboard.css';

// Move this to the top or bottom of the file, outside any function/component:
function OrderFulfillmentTracker({ requestId, supplierId, initialStatus, packingTimestamp, dispatchedTimestamp, deliveredTimestamp }) {
  const [localStatus, setLocalStatus] = React.useState(initialStatus || 'accepted');
  const [updating, setUpdating] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');

  const handleUpdateStatus = async (nextStatus) => {
    setUpdating(true);
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/fulfillment-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: supplierId, fulfillment_status: nextStatus })
      });
      const result = await response.json();
      if (result.success) {
        setLocalStatus(nextStatus);
        setSuccessMsg(`Status updated to ${nextStatus}`);
      } else {
        setSuccessMsg(result.error || 'Error updating status');
      }
    } catch (e) {
      setSuccessMsg('Error updating status');
    } finally {
      setUpdating(false);
      setTimeout(() => setSuccessMsg(''), 2000);
    }
  };

  let nextStep = null;
  if (localStatus === 'accepted') nextStep = 'packing';
  else if (localStatus === 'packing') nextStep = 'dispatched';
  else if (localStatus === 'dispatched') nextStep = 'delivered';

  const stepColor = (step) => {
    if (step === localStatus) return '#f59e42';
    if (
      (step === 'packing' && ['packing', 'dispatched', 'delivered'].includes(localStatus)) ||
      (step === 'dispatched' && ['dispatched', 'delivered'].includes(localStatus)) ||
      (step === 'delivered' && localStatus === 'delivered')
    ) return '#10b981';
    return '#d1d5db';
  };

  const formatTimestamp = (ts) => ts ? new Date(ts).toLocaleString() : '';

  return (
    <div style={{ margin: '16px 0' }}>
      {/* Tracker icons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: stepColor('packing'), fontWeight: 600, fontSize: 20 }}>📦</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: stepColor('dispatched'), fontWeight: 600, fontSize: 20 }}>🚚</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ color: stepColor('delivered'), fontWeight: 600, fontSize: 20 }}>🎉</div>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 }}>
        <div style={{ flex: 1, height: 4, background: stepColor('packing'), borderRadius: 2 }}></div>
        <div style={{ flex: 1, height: 4, background: stepColor('dispatched'), borderRadius: 2, margin: '0 4px' }}></div>
        <div style={{ flex: 1, height: 4, background: stepColor('delivered'), borderRadius: 2 }}></div>
      </div>
      {/* Timestamps below each icon */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', fontSize: 12, color: '#bbb', marginBottom: 8, marginTop: 2 }}>
        <div style={{ flex: 1, textAlign: 'center', minHeight: 18 }}>{formatTimestamp(packingTimestamp)}</div>
        <div style={{ flex: 1, textAlign: 'center', minHeight: 18 }}>{formatTimestamp(dispatchedTimestamp)}</div>
        <div style={{ flex: 1, textAlign: 'center', minHeight: 18 }}>{formatTimestamp(deliveredTimestamp)}</div>
      </div>
      {nextStep && (
        <button
          onClick={() => handleUpdateStatus(nextStep)}
          disabled={updating}
          style={{
            marginTop: 8,
            background: '#f59e42',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '8px 18px',
            fontWeight: 600,
            fontSize: 14,
            cursor: updating ? 'not-allowed' : 'pointer',
            opacity: updating ? 0.7 : 1
          }}
        >
          {updating ? 'Updating...' :
            nextStep === 'packing' ? 'Mark as Packed' :
            nextStep === 'dispatched' ? 'Mark as Dispatched' :
            nextStep === 'delivered' ? 'Mark as Delivered' :
            'Update Status'}
        </button>
      )}
      {successMsg && <div style={{ marginTop: 8, color: '#10b981', fontWeight: 600 }}>{successMsg}</div>}
    </div>
  );
}

export default function SupplierDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editMaterial, setEditMaterial] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notif, setNotif] = useState([]);
  const [acceptModal, setAcceptModal] = useState({ open: false, request: null, breakdown: null });
  const [priceBreakdown, setPriceBreakdown] = useState(null);

  // Fetch supplier profile, stats, materials, orders
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:5001/suppliers').then(res => res.json()),
      fetch(`http://localhost:5001/supplier-products/${user.supplier_id || user.user_id}`).then(res => res.json()),
      fetch('http://localhost:5001/orders').then(res => res.json()),
    ]).then(([suppliers, materialsData, ordersData]) => {
      const supplier = suppliers.find(s => s.email === user.email);
      setProfile(supplier);
      setMaterials(materialsData);
      setOrders(ordersData.filter(o => o.supplier_id === supplier?.id));
      setStats({
        totalProducts: materialsData.length,
        pendingOrders: ordersData.filter(o => o.supplier_id === supplier?.id && o.status !== 'delivered').length,
        completedOrders: ordersData.filter(o => o.supplier_id === supplier?.id && o.status === 'delivered').length,
        avgPrice: materialsData.length ? (materialsData.reduce((a, b) => a + (b.unit_price || 0), 0) / materialsData.length).toFixed(2) : 0
      });
      setLoading(false);
    }).catch(e => {
      setError('Failed to load dashboard data.');
      setLoading(false);
    });
  }, [user]);

  // Notification simulation (could be replaced with real API)
  useEffect(() => {
    if (!profile) return;
    const n = [];
    if (stats && stats.pendingOrders > 0) n.push({ type: 'order', msg: `You have ${stats.pendingOrders} pending orders.` });
    if (materials.some(m => m.current_stock < 5)) n.push({ type: 'stock', msg: 'Some products are low on stock.' });
    setNotif(n);
  }, [stats, materials, profile]);

  // Handlers for add/edit/delete/search material
  const handleAddMaterial = () => { setEditMaterial(null); setShowMaterialModal(true); };
  const handleEditMaterial = (mat) => { setEditMaterial(mat); setShowMaterialModal(true); };
  const handleDeleteMaterial = (matId) => {
    if (!window.confirm('Delete this material?')) return;
    fetch(`http://localhost:5001/products/${matId}`, { method: 'DELETE' })
      .then(() => setMaterials(mats => mats.filter(m => m.product_id !== matId)))
      .catch(() => setError('Failed to delete material.'));
  };
  const handleSaveMaterial = (mat) => {
    // Add or update material
    const method = mat.product_id ? 'PUT' : 'POST';
    const url = mat.product_id ? `http://localhost:5001/products/${mat.product_id}` : 'http://localhost:5001/products';
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mat)
    })
      .then(res => res.json())
      .then(data => {
        setShowMaterialModal(false);
        setEditMaterial(null);
        // Refresh materials
        return fetch(`http://localhost:5001/supplier-products/${profile.id}`).then(res => res.json()).then(setMaterials);
      })
      .catch(() => setError('Failed to save material.'));
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      if (onLogout) {
        onLogout();
      } else {
        // Fallback logout if onLogout prop is not provided
        localStorage.removeItem('user');
        window.location.href = '/';
      }
    }
  };
  const filteredMaterials = materials.filter(m => m.product_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  // Main render
  if (loading) return <div className="supplier-dashboard-container">Loading...</div>;
  if (error) return <div className="supplier-dashboard-container">{error}</div>;

  return (
    <div className="supplier-dashboard-container">
      <div className="supplier-dashboard-header">
        <h1>Welcome, {profile?.name || user.username}</h1>
        <div className="header-actions">
          <button className="action-btn" onClick={handleAddMaterial}>Add Material</button>
          <button className="action-btn" onClick={() => setActiveTab('profile')}>Profile & Settings</button>
          <button 
            className="action-btn logout-btn" 
            onClick={handleLogout}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
      {/* Notifications */}
      {notif.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {notif.map((n, i) => (
            <div key={i} style={{ background: '#222', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 6 }}>{n.msg}</div>
          ))}
        </div>
      )}
      {/* Stats */}
      <div className="supplier-stats-grid">
        <div className="supplier-stat-card">
          <div className="supplier-stat-title">Total Products</div>
          <div className="supplier-stat-value">{stats.totalProducts}</div>
          <div className="supplier-stat-label">Materials you supply</div>
        </div>
        <div className="supplier-stat-card">
          <div className="supplier-stat-title">Pending Orders</div>
          <div className="supplier-stat-value">{stats.pendingOrders}</div>
          <div className="supplier-stat-label">Orders to fulfill</div>
        </div>
        <div className="supplier-stat-card">
          <div className="supplier-stat-title">Completed Orders</div>
          <div className="supplier-stat-value">{stats.completedOrders}</div>
          <div className="supplier-stat-label">Delivered successfully</div>
        </div>
        <div className="supplier-stat-card">
          <div className="supplier-stat-title">Avg. Price</div>
          <div className="supplier-stat-value">₹{stats.avgPrice}</div>
          <div className="supplier-stat-label">Per material</div>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ margin: '32px 0' }}>
        <button className={`action-btn${activeTab === 'overview' ? ' active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`action-btn${activeTab === 'materials' ? ' active' : ''}`} onClick={() => setActiveTab('materials')}>Materials</button>
        <button className={`action-btn${activeTab === 'orders' ? ' active' : ''}`} onClick={() => setActiveTab('orders')}>Orders</button>
        <button className={`action-btn${activeTab === 'requested' ? ' active' : ''}`} onClick={() => setActiveTab('requested')}>Requested Materials</button>
        <button className={`action-btn${activeTab === 'analytics' ? ' active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</button>
        <button className={`action-btn${activeTab === 'profile' ? ' active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
      </div>
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Recent Orders</h2>
          <div style={{ background: '#181818', borderRadius: 12, padding: 24 }}>
            {orders.length === 0 ? <div style={{ color: '#bbb' }}>No orders yet.</div> : (
              <table style={{ width: '100%', color: '#fff' }}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Delivery Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map(o => (
                    <tr key={o.id}>
                      <td>{o.order_number}</td>
                      <td>{o.product_name}</td>
                      <td>{o.quantity}</td>
                      <td>{o.status}</td>
                      <td>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {activeTab === 'materials' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search materials..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff', width: 240 }}
            />
          </div>
          <div style={{ background: '#181818', borderRadius: 12, padding: 24 }}>
            {filteredMaterials.length === 0 ? <div style={{ color: '#bbb' }}>No materials found.</div> : (
              <table style={{ width: '100%', color: '#fff' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.map(mat => (
                    <tr key={mat.product_id}>
                      <td>{mat.product_name}</td>
                      <td>{mat.product_category}</td>
                      <td>{mat.product_unit}</td>
                      <td>₹{mat.unit_price}</td>
                      <td>{mat.current_stock}</td>
                      <td>
                        <button className="action-btn" onClick={() => handleEditMaterial(mat)}>Edit</button>
                        <button className="action-btn" onClick={() => handleDeleteMaterial(mat.product_id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {activeTab === 'orders' && (
        <div>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>All Orders</h2>
          <div style={{ background: '#181818', borderRadius: 12, padding: 24 }}>
            {orders.length === 0 ? <div style={{ color: '#bbb' }}>No orders yet.</div> : (
              <table style={{ width: '100%', color: '#fff' }}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Delivery Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>{o.order_number}</td>
                      <td>{o.product_name}</td>
                      <td>{o.quantity}</td>
                      <td>{o.status}</td>
                      <td>{o.delivery_date ? new Date(o.delivery_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {activeTab === 'requested' && (
        <>
          <div style={{ background: '#181818', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid #333' }}>
            <h3 style={{ color: '#fff', marginBottom: 12 }}>📋 How It Works</h3>
            <div style={{ color: '#ccc', fontSize: 14, lineHeight: 1.6 }}>
              <p><strong>1. Review Requests:</strong> Browse incoming material requests from admin</p>
              <p><strong>2. Accept/Reject First:</strong> You can directly accept or reject requests before submitting quotes</p>
              <p><strong>3. Submit Quotes (Optional):</strong> If you accept, you can optionally provide pricing details</p>
              <p><strong>4. Auto-Rejection:</strong> When you accept, all other suppliers are automatically rejected</p>
              <p><strong>5. Track Status:</strong> Monitor request status (Pending, Accepted, Rejected)</p>
              <p><strong>6. Fulfill Orders:</strong> Once accepted, proceed with packing and dispatch</p>
            </div>
          </div>
          <RequestedMaterialsTab supplierId={profile?.id} priceBreakdown={priceBreakdown} setPriceBreakdown={setPriceBreakdown} />
          <div style={{ marginTop: 32 }}>
            <h2 style={{ color: '#fff', marginBottom: 16 }}>Your Submitted Quotes</h2>
            <SupplierQuotesSection supplierId={profile?.id} />
          </div>
        </>
      )}
      {activeTab === 'analytics' && (
        <div>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Performance Analytics</h2>
          <div style={{ background: '#181818', borderRadius: 12, padding: 24 }}>
            {/* Placeholder for charts - you can integrate recharts or chart.js here */}
            <div style={{ color: '#bbb', textAlign: 'center' }}>[Charts coming soon]</div>
          </div>
        </div>
      )}
      {activeTab === 'profile' && (
        <div>
          <h2 style={{ color: '#fff', marginBottom: 16 }}>Profile & Settings</h2>
          <div style={{ background: '#181818', borderRadius: 12, padding: 24, maxWidth: 500 }}>
            <div style={{ marginBottom: 12 }}><b>Name:</b> {profile?.name}</div>
            <div style={{ marginBottom: 12 }}><b>Email:</b> {profile?.email}</div>
            <div style={{ marginBottom: 12 }}><b>Phone:</b> {profile?.phone}</div>
            <div style={{ marginBottom: 12 }}><b>Company:</b> {profile?.company}</div>
            <div style={{ marginBottom: 12 }}><b>Tax ID:</b> {profile?.tax_id}</div>
            <div style={{ marginBottom: 12 }}><b>Address:</b> {profile?.address}</div>
            {/* Add edit profile functionality if needed */}
          </div>
        </div>
      )}
      {/* Material Modal (Add/Edit) */}
      {showMaterialModal && (
        <MaterialModal
          material={editMaterial}
          onClose={() => { setShowMaterialModal(false); setEditMaterial(null); }}
          onSave={handleSaveMaterial}
        />
      )}
      {acceptModal.open && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#222', borderRadius: 12, padding: 32, minWidth: 350, color: '#fff', boxShadow: '0 4px 32px #0008' }}>
            <h2 style={{ color: '#10b981', marginBottom: 16 }}>Confirm Acceptance</h2>
            {acceptModal.breakdown ? (
              acceptModal.breakdown.error ? (
                <div style={{ color: '#e74c3c', marginBottom: 16 }}>{acceptModal.breakdown.error}</div>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>Subtotal: <b>₹{acceptModal.request.total_amount?.toLocaleString() || 0}</b></div>
                  <div style={{ marginBottom: 8 }}>Shipping ({acceptModal.breakdown.distance_km} km): <b>₹{acceptModal.breakdown.shipping_cost?.toLocaleString()}</b></div>
                  <div style={{ marginBottom: 8 }}>GST/IGST: <b>₹{acceptModal.breakdown.tax_amount?.toLocaleString()}</b></div>
                  <div style={{ marginBottom: 8 }}>Grand Total: <b style={{ color: '#f59e42' }}>₹{acceptModal.breakdown.grand_total?.toLocaleString()}</b></div>
                  <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>
                    Tax Type: {acceptModal.breakdown.tax_breakdown?.tax_type} | State: {acceptModal.breakdown.tax_breakdown?.supplier_state}
                  </div>
                </>
              )
            ) : (
              <div style={{ color: '#bbb', marginBottom: 16 }}>Calculating...</div>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button onClick={() => setAcceptModal({ open: false, request: null, breakdown: null })} style={{ background: '#374151', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirmAccept} disabled={!acceptModal.breakdown || acceptModal.breakdown.error} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', opacity: (!acceptModal.breakdown || acceptModal.breakdown.error) ? 0.5 : 1 }}>Confirm & Accept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestedMaterialsTab({ supplierId, priceBreakdown, setPriceBreakdown }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [quote, setQuote] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  // Add state to track submitted quotes
  const [submittedQuotes, setSubmittedQuotes] = useState([]);

  useEffect(() => {
    setLoading(true);
    fetch(`http://localhost:5001/supplier-requests/supplier/${supplierId}`)
      .then(res => res.json())
      .then(async (data) => {
        // Fetch shipping costs for each request
        const requestsWithShipping = await Promise.all(
          data.map(async (req) => {
            try {
              const subtotal = req.total_amount || 0;
              const shippingResponse = await fetch(
                `http://localhost:5001/supplier-shipping-cost/${supplierId}?delivery_address=${encodeURIComponent(req.delivery_address || '')}&subtotal=${subtotal}&product_category=machinery`
              );
              if (shippingResponse.ok) {
                const shippingData = await shippingResponse.json();
                return {
                  ...req,
                  shipping_distance: shippingData.distance_km,
                  shipping_cost: shippingData.shipping_cost,
                  tax_breakdown: shippingData.tax_breakdown,
                  grand_total: shippingData.grand_total
                };
              }
            } catch (error) {
              console.error('Error fetching shipping cost:', error);
            }
            return req;
          })
        );
        
        setRequests(requestsWithShipping);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load requests.'); setLoading(false); });
    
    // Fetch all quotes for this supplier
    fetch(`http://localhost:5001/supplier-request-quotes`)
      .then(res => res.json())
      .then(data => setSubmittedQuotes(data.filter(q => q.supplier_id === supplierId)));
  }, [supplierId]);

  const openRequest = (req) => {
    console.log('Opening request:', req);
    setLoading(true);
    fetch(`http://localhost:5001/supplier-requests/${req.id}`)
      .then(res => {
        console.log('Fetch response:', res);
        return res.json();
      })
      .then(async data => {
        console.log('Fetched data:', data);
        setSelectedRequest(data); setLoading(false); setQuote({}); setSuccessMsg('');
        // Fetch price breakdown for this request
        try {
          const subtotal = data.total_amount || 0;
          const res = await fetch(
            `http://localhost:5001/supplier-shipping-cost/${supplierId}?delivery_address=${encodeURIComponent(data.delivery_address || '')}&subtotal=${subtotal}&product_category=machinery`
          );
          if (res.ok) {
            const breakdown = await res.json();
            setPriceBreakdown(breakdown);
          } else {
            setPriceBreakdown({ error: 'Failed to fetch price breakdown.' });
          }
        } catch (e) {
          setPriceBreakdown({ error: 'Failed to fetch price breakdown.' });
        }
      })
      .catch((e) => { 
        setError('Failed to load request details.'); 
        setLoading(false); 
        console.error('Fetch error:', e);
      });
  };

  const handleQuoteChange = (itemId, value) => {
    setQuote(q => ({ ...q, [itemId]: value }));
  };

  const handleSubmitQuote = () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    const items = selectedRequest.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: parseFloat(quote[item.id] || item.unit_price || 0)
    }));
    fetch('http://localhost:5001/supplier-request-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: selectedRequest.id,
        supplier_id: supplierId,
        items,
        delivery_date: quote.delivery_date || selectedRequest.expected_delivery_date,
        fulfillment_date: quote.fulfillment_date || ''
      })
    })
      .then(res => res.json())
      .then(data => {
        setSubmitting(false);
        if (data.success) {
          setSuccessMsg('Quote submitted successfully!');
        } else {
          setError(data.error || 'Failed to submit quote.');
        }
      })
      .catch(() => { setError('Failed to submit quote.'); setSubmitting(false); });
  };

  if (loading) return <div style={{ color: '#fff' }}>Loading...</div>;
  if (error) return <div style={{ color: '#e74c3c' }}>{error}</div>;

  const existingQuote = submittedQuotes.find(q => q.request_id === selectedRequest?.id);

  // Organize requests by status
  const organizeRequests = () => {
    const organized = {
      pending: [],
      accepted: [],
      rejected: [],
      fulfilled: [],
      revised_offers: [],
      counter_offered: []
    };

    requests.forEach(req => {
      // For supplier-specific requests, the status field contains the supplier's status
      const supplierStatus = req.status;
      
      switch (supplierStatus) {
        case 'accepted':
          organized.accepted.push(req);
          break;
        case 'rejected':
          organized.rejected.push(req);
          break;
        case 'revised_offer':
          organized.revised_offers.push(req);
          break;
        case 'counter_offered':
          organized.counter_offered.push(req);
          break;
        case 'pending':
          organized.pending.push(req);
          break;
        default:
          organized.pending.push(req);
      }
    });

    return organized;
  };

  const organizedRequests = organizeRequests();

  return (
    <div>
      <h2 style={{ color: '#fff', marginBottom: 24 }}>Requested Materials</h2>
      
      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '32px' 
      }}>
        <div style={{ 
          background: '#f59e42', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {organizedRequests.pending.length}
          </div>
          <div style={{ fontSize: '14px' }}>Pending Requests</div>
        </div>
        
        <div style={{ 
          background: '#10b981', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {organizedRequests.accepted.length}
          </div>
          <div style={{ fontSize: '14px' }}>Accepted Requests</div>
        </div>
        
        <div style={{ 
          background: '#e74c3c', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {organizedRequests.rejected.length}
          </div>
          <div style={{ fontSize: '14px' }}>Rejected Requests</div>
        </div>
        
        <div style={{ 
          background: '#3b82f6', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {organizedRequests.fulfilled.length}
          </div>
          <div style={{ fontSize: '14px' }}>Fulfilled by Others</div>
        </div>
        
        <div style={{ 
          background: '#8b5cf6', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {organizedRequests.revised_offers.length}
          </div>
          <div style={{ fontSize: '14px' }}>Revised Offers</div>
        </div>
        
        <div style={{ 
          background: '#06b6d4', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {organizedRequests.counter_offered.length}
          </div>
          <div style={{ fontSize: '14px' }}>Counter Offers</div>
        </div>
      </div>

      {/* Pending Requests Section */}
      {organizedRequests.pending.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#f59e42', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⏳ Pending Requests ({organizedRequests.pending.length})
          </h3>
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid #333'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '16px' 
            }}>
              {organizedRequests.pending.map(req => (
                <div key={req.id} style={{ 
                  background: '#222', 
                  borderRadius: '8px', 
                  padding: '16px',
                  border: '1px solid #444'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{req.request_number}</div>
                      <div style={{ color: '#bbb', fontSize: '12px' }}>{req.title}</div>
                    </div>
                    <div style={{ 
                      background: '#f59e42', 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '10px',
                      fontWeight: '600'
                    }}>
                      PENDING
                    </div>
                  </div>
                  <div style={{ color: '#bbb', fontSize: '12px', marginBottom: '12px' }}>
                    Due: {req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString() : 'Not set'}
                  </div>
                  <button 
                    className="action-btn" 
                    onClick={() => openRequest(req)}
                    style={{ width: '100%', background: '#f59e42', color: 'white' }}
                  >
                    View & Respond
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Accepted Requests Section */}
      {organizedRequests.accepted.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#10b981', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✅ Accepted Requests ({organizedRequests.accepted.length})
          </h3>
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid #333'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
              gap: '16px' 
            }}>
              {organizedRequests.accepted.map(req => {
                // Fallback: If req.suppliers is missing, use fulfillment fields directly from req
                let supplierObj = null;
                if (req.suppliers && Array.isArray(req.suppliers)) {
                  supplierObj = req.suppliers.find(s => s.id === supplierId);
                } else {
                  supplierObj = {
                    fulfillment_status: req.fulfillment_status,
                    packing_timestamp: req.packing_timestamp,
                    dispatched_timestamp: req.dispatched_timestamp,
                    delivered_timestamp: req.delivered_timestamp
                  };
                }
                return (
                  <div key={req.id} style={{ background: '#222', borderRadius: '8px', padding: '16px', border: '1px solid #10b981', marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{req.request_number}</div>
                        <div style={{ color: '#bbb', fontSize: '12px' }}>{req.title}</div>
                      </div>
                      <div style={{ 
                        background: '#10b981', 
                        color: 'white', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        ACCEPTED
                      </div>
                    </div>
                    <div style={{ color: '#bbb', fontSize: '12px', marginBottom: '12px' }}>
                      Due: {req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString() : 'Not set'}
                    </div>
                    
                    {/* Shipping & Tax Information */}
                    <div style={{ 
                      background: '#1f2937', 
                      padding: '8px 12px', 
                      borderRadius: '6px', 
                      marginBottom: '12px',
                      border: '1px solid #374151'
                    }}>
                      <div style={{ color: '#10b981', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                        🚚 Shipping & Tax Information
                      </div>
                      <div style={{ color: '#d1d5db', fontSize: '10px' }}>
                        Distance: {req.shipping_distance || 'Calculating...'} km
                      </div>
                      <div style={{ color: '#d1d5db', fontSize: '10px' }}>
                        Shipping: ₹{req.shipping_cost ? req.shipping_cost.toLocaleString() : 'Calculating...'}
                      </div>
                      {req.tax_breakdown && (
                        <>
                          <div style={{ color: '#d1d5db', fontSize: '10px' }}>
                            Tax: ₹{req.tax_breakdown.total_tax ? req.tax_breakdown.total_tax.toLocaleString() : 'Calculating...'}
                          </div>
                          <div style={{ color: '#d1d5db', fontSize: '10px' }}>
                            Total: ₹{req.grand_total ? req.grand_total.toLocaleString() : 'Calculating...'}
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Fulfillment Tracker */}
                    <OrderFulfillmentTracker
                      requestId={req.id}
                      supplierId={supplierId}
                      initialStatus={supplierObj?.fulfillment_status}
                      packingTimestamp={supplierObj?.packing_timestamp}
                      dispatchedTimestamp={supplierObj?.dispatched_timestamp}
                      deliveredTimestamp={supplierObj?.delivered_timestamp}
                    />
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button 
                        className="action-btn" 
                        onClick={() => openRequest(req)}
                        style={{ flex: 1, background: '#10b981', color: 'white' }}
                      >
                        View Details
                      </button>
                      
                      {/* Download Invoice Button - Only show for delivered requests */}
                      {req.fulfillment_status === 'delivered' && (
                        <button 
                          style={{ 
                            background: '#8b5cf6', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px', 
                            padding: '8px 12px', 
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap'
                          }}
                          onClick={() => {
                            let downloadId = supplierId;
                            if (req.suppliers && req.suppliers.length > 0) {
                              const acceptedSupplier = req.suppliers.find(s => s.status === 'accepted');
                              if (acceptedSupplier) downloadId = acceptedSupplier.id;
                            }
                            window.open(`http://localhost:5001/supplier-requests/${req.id}/download-invoice/${downloadId}`, '_blank');
                          }}
                        >
                          📄 Invoice
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rejected Requests Section */}
      {organizedRequests.rejected.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#e74c3c', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ❌ Rejected Requests ({organizedRequests.rejected.length})
          </h3>
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid #333'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '16px' 
            }}>
              {organizedRequests.rejected.map(req => (
                <div key={req.id} style={{ 
                  background: '#222', 
                  borderRadius: '8px', 
                  padding: '16px',
                  border: '1px solid #e74c3c',
                  opacity: '0.7'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{req.request_number}</div>
                      <div style={{ color: '#bbb', fontSize: '12px' }}>{req.title}</div>
                    </div>
                    <div style={{ 
                      background: '#e74c3c', 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '10px',
                      fontWeight: '600'
                    }}>
                      REJECTED
                    </div>
                  </div>
                  <div style={{ color: '#bbb', fontSize: '12px', marginBottom: '12px' }}>
                    Due: {req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString() : 'Not set'}
                  </div>
                  <button 
                    className="action-btn" 
                    onClick={() => openRequest(req)}
                    style={{ width: '100%', background: '#e74c3c', color: 'white' }}
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fulfilled by Others Section */}
      {organizedRequests.fulfilled.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#3b82f6', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏆 Fulfilled by Others ({organizedRequests.fulfilled.length})
          </h3>
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid #333'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '16px' 
            }}>
              {organizedRequests.fulfilled.map(req => {
                const acceptedSupplier = req.suppliers?.find(s => s.status === 'accepted');
                return (
                  <div key={req.id} style={{ 
                    background: '#222', 
                    borderRadius: '8px', 
                    padding: '16px',
                    border: '1px solid #3b82f6',
                    opacity: '0.8'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{req.request_number}</div>
                        <div style={{ color: '#bbb', fontSize: '12px' }}>{req.title}</div>
                      </div>
                      <div style={{ 
                        background: '#3b82f6', 
                        color: 'white', 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        FULFILLED
                      </div>
                    </div>
                    <div style={{ color: '#bbb', fontSize: '12px', marginBottom: '8px' }}>
                      Due: {req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString() : 'Not set'}
                    </div>
                    <div style={{ color: '#10b981', fontSize: '12px', marginBottom: '12px', fontWeight: '600' }}>
                      Accepted by: {acceptedSupplier?.name || 'Unknown'}
                    </div>
                    <button 
                      className="action-btn" 
                      onClick={() => openRequest(req)}
                      style={{ width: '100%', background: '#3b82f6', color: 'white' }}
                    >
                      View Details
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Revised Offers Section */}
      {organizedRequests.revised_offers.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#8b5cf6', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📝 Revised Offers ({organizedRequests.revised_offers.length})
          </h3>
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid #333'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '16px' 
            }}>
              {organizedRequests.revised_offers.map(req => (
                <div key={req.id} style={{ 
                  background: '#222', 
                  borderRadius: '8px', 
                  padding: '16px',
                  border: '1px solid #8b5cf6'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{req.request_number}</div>
                      <div style={{ color: '#bbb', fontSize: '12px' }}>{req.title}</div>
                    </div>
                    <div style={{ 
                      background: '#8b5cf6', 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '10px',
                      fontWeight: '600'
                    }}>
                      REVISED OFFER
                    </div>
                  </div>
                  <div style={{ color: '#bbb', fontSize: '12px', marginBottom: '12px' }}>
                    Due: {req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString() : 'Not set'}
                  </div>
                  <button 
                    className="action-btn" 
                    onClick={() => openRequest(req)}
                    style={{ width: '100%', background: '#8b5cf6', color: 'white' }}
                  >
                    View & Track
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Counter Offers Section */}
      {organizedRequests.counter_offered.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#06b6d4', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💼 Counter Offers ({organizedRequests.counter_offered.length})
          </h3>
          <div style={{ 
            background: '#1a1a1a', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid #333'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
              gap: '16px' 
            }}>
              {organizedRequests.counter_offered.map(req => (
                <div key={req.id} style={{ 
                  background: '#222', 
                  borderRadius: '8px', 
                  padding: '16px',
                  border: '1px solid #06b6d4'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{req.request_number}</div>
                      <div style={{ color: '#bbb', fontSize: '12px' }}>{req.title}</div>
                    </div>
                    <div style={{ 
                      background: '#06b6d4', 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '10px',
                      fontWeight: '600'
                    }}>
                      COUNTER OFFER
                    </div>
                  </div>
                  <div style={{ color: '#bbb', fontSize: '12px', marginBottom: '12px' }}>
                    Due: {req.expected_delivery_date ? new Date(req.expected_delivery_date).toLocaleDateString() : 'Not set'}
                  </div>
                  <button 
                    className="action-btn" 
                    onClick={() => openRequest(req)}
                    style={{ width: '100%', background: '#06b6d4', color: 'white' }}
                  >
                    Review & Respond
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <div style={{ 
          background: '#1a1a1a', 
          borderRadius: '12px', 
          padding: '40px', 
          textAlign: 'center',
          border: '1px solid #333'
        }}>
          <div style={{ color: '#bbb', fontSize: '16px' }}>No requests found.</div>
        </div>
      )}
      {selectedRequest && (
        <div style={{ background: '#181818', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h3 style={{ color: '#fff' }}>Request: {selectedRequest.title}</h3>
          {/* Price Breakdown Section */}
          <div style={{ marginBottom: 16, background: '#232323', borderRadius: 8, padding: 16 }}>
            <h4 style={{ color: '#10b981', marginBottom: 8 }}>Price Breakdown</h4>
            {priceBreakdown ? (
              priceBreakdown.error ? (
                <div style={{ color: '#e74c3c' }}>{priceBreakdown.error}</div>
              ) : (
                <>
                  <div>Subtotal: <b>₹{selectedRequest.total_amount?.toLocaleString() || 0}</b></div>
                  <div>Shipping ({priceBreakdown.distance_km} km): <b>₹{priceBreakdown.shipping_cost?.toLocaleString()}</b></div>
                  {/* GST/IGST/CGST/SGST Details */}
                  {priceBreakdown.tax_breakdown && (
                    <div style={{ margin: '8px 0', padding: '8px', background: '#222', borderRadius: 6 }}>
                      <div style={{ color: '#10b981', fontWeight: 600 }}>GST Details:</div>
                      <div>Tax Type: <b>{priceBreakdown.tax_breakdown.tax_type}</b></div>
                      <div>Tax Rate: <b>{priceBreakdown.tax_breakdown.tax_rate_percent || (priceBreakdown.tax_breakdown.tax_rate ? `${(priceBreakdown.tax_breakdown.tax_rate*100).toFixed(0)}%` : '')}</b></div>
                      {priceBreakdown.tax_breakdown.cgst > 0 && (
                        <div>CGST: <b>₹{priceBreakdown.tax_breakdown.cgst.toLocaleString(undefined, {minimumFractionDigits: 2})}</b></div>
                      )}
                      {priceBreakdown.tax_breakdown.sgst > 0 && (
                        <div>SGST: <b>₹{priceBreakdown.tax_breakdown.sgst.toLocaleString(undefined, {minimumFractionDigits: 2})}</b></div>
                      )}
                      {priceBreakdown.tax_breakdown.igst > 0 && (
                        <div>IGST: <b>₹{priceBreakdown.tax_breakdown.igst.toLocaleString(undefined, {minimumFractionDigits: 2})}</b></div>
                      )}
                      <div>Total Tax: <b>₹{priceBreakdown.tax_breakdown.total_tax?.toLocaleString(undefined, {minimumFractionDigits: 2})}</b></div>
                      <div style={{ fontSize: 12, color: '#bbb' }}>State: {priceBreakdown.tax_breakdown.supplier_state} | Interstate: {priceBreakdown.tax_breakdown.is_interstate ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                  <div>Grand Total: <b style={{ color: '#f59e42' }}>₹{priceBreakdown.grand_total?.toLocaleString()}</b></div>
                </>
              )
            ) : (
              <div style={{ color: '#bbb' }}>Calculating...</div>
            )}
          </div>
          <div style={{ color: '#bbb', marginBottom: 12 }}>{selectedRequest.description}</div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#fff', marginRight: 8 }}>Proposed Delivery Date:</label>
            <input
              type="date"
              value={quote.delivery_date || selectedRequest.expected_delivery_date?.slice(0, 10) || ''}
              onChange={e => setQuote(q => ({ ...q, delivery_date: e.target.value }))}
              style={{ padding: 6, borderRadius: 6, border: '1px solid #333', background: '#222', color: '#fff', width: 180 }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#fff', marginRight: 8 }}>Date of Fulfillment:</label>
            <input
              type="date"
              value={quote.fulfillment_date || ''}
              onChange={e => setQuote(q => ({ ...q, fulfillment_date: e.target.value }))}
              style={{ padding: 6, borderRadius: 6, border: '1px solid #333', background: '#222', color: '#fff', width: 180 }}
            />
          </div>
          <table style={{ width: '100%', color: '#fff', marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Material</th>
                <th>Quantity</th>
                <th>Your Price (per unit)</th>
              </tr>
            </thead>
            <tbody>
              {selectedRequest.items.map(item => (
                <tr key={item.id}>
                  <td>{item.product_name}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={quote[item.id] || item.unit_price || ''}
                      onChange={e => handleQuoteChange(item.id, e.target.value)}
                      style={{ padding: 6, borderRadius: 6, border: '1px solid #333', background: '#222', color: '#fff', width: 100 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Action buttons with proper state management */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <h4 style={{ color: '#fff', margin: '0 0 12px 0', width: '100%' }}>Request Actions:</h4>
            
            {/* Check if any supplier has accepted this request */}
            {(() => {
              const acceptedSupplier = selectedRequest.suppliers?.find(s => s.status === 'accepted');
              const currentSupplier = selectedRequest.suppliers?.find(s => s.id === supplierId);
              const isCurrentSupplierAccepted = currentSupplier?.status === 'accepted';
              const isCurrentSupplierRejected = currentSupplier?.status === 'rejected';
              const isCurrentSupplierPending = currentSupplier?.status === 'pending';
              
              // If another supplier has accepted, show expired message
              if (acceptedSupplier && acceptedSupplier.id !== supplierId) {
                return (
                  <div style={{ 
                    background: '#e74c3c', 
                    color: 'white', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    fontWeight: 600,
                    width: '100%'
                  }}>
                    ❌ Request Fulfilled - Another supplier ({acceptedSupplier.name}) has accepted this request
                  </div>
                );
              }
              
              // If current supplier has rejected, show rejected message
              if (isCurrentSupplierRejected) {
                return (
                  <div style={{ 
                    background: '#e74c3c', 
                    color: 'white', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    fontWeight: 600,
                    width: '100%'
                  }}>
                    ❌ Request Rejected - You have rejected this request
                  </div>
                );
              }
              
              // If current supplier has accepted, show accepted message
              if (isCurrentSupplierAccepted) {
                return (
                  <div style={{ width: '100%' }}>
                    <div style={{ 
                      background: '#27ae60', 
                      color: 'white', 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      fontWeight: 600,
                      marginBottom: 12
                    }}>
                      ✅ Request Accepted - You can now proceed with fulfillment
                    </div>
                    <OrderFulfillmentTracker
                      requestId={selectedRequest.id}
                      supplierId={supplierId}
                      initialStatus={currentSupplier.fulfillment_status}
                      packingTimestamp={currentSupplier?.packing_timestamp}
                      dispatchedTimestamp={currentSupplier?.dispatched_timestamp}
                      deliveredTimestamp={currentSupplier?.delivered_timestamp}
                    />
                  </div>
                );
              }

              // If current supplier has sent a revised offer, show pending review message
              if (currentSupplier?.status === 'revised_offer') {
                return (
                  <div style={{ 
                    background: '#f59e42', 
                    color: 'white', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    fontWeight: 600,
                    width: '100%'
                  }}>
                    📝 Revised Offer Sent - Waiting for admin response
                  </div>
                );
              }

              // If current supplier has received a counter offer, show counter offer message
              if (currentSupplier?.status === 'counter_offered') {
                return (
                  <div style={{ 
                    background: '#3b82f6', 
                    color: 'white', 
                    padding: '12px 16px', 
                    borderRadius: '8px', 
                    fontWeight: 600,
                    width: '100%'
                  }}>
                    💼 Counter Offer Received - Review admin's counter proposal
                  </div>
                );
              }
              
              // Show accept/reject/revised offer buttons only if current supplier is pending and no one has accepted
              if (isCurrentSupplierPending && !acceptedSupplier) {
                return (
                  <>
            {/* Accept Request Button */}
            <button 
              className="action-btn" 
              style={{ background: '#27ae60', color: 'white' }}
              onClick={async () => {
                try {
                  setSubmitting(true);
                          // Accept the request directly without quote
                          const response = await fetch(`http://localhost:5001/supplier-requests/${selectedRequest.id}/supplier-accept`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ supplier_id: supplierId })
                  });
                  const result = await response.json();
                  
                  if (result.success) {
                    setSuccessMsg(`✅ Request accepted successfully! You can now proceed with fulfillment.`);
                    // Refresh the requests list to show updated status
                    const requestsResponse = await fetch(`http://localhost:5001/supplier-requests/supplier/${supplierId}`);
                    const updatedRequests = await requestsResponse.json();
                    setRequests(updatedRequests);
                            // Refresh the selected request to get updated supplier statuses
                            const requestResponse = await fetch(`http://localhost:5001/supplier-requests/${selectedRequest.id}`);
                            const updatedRequest = await requestResponse.json();
                            setSelectedRequest(updatedRequest);
                  } else {
                    setSuccessMsg(`❌ Error: ${result.error}`);
                  }
                } catch (error) {
                  setSuccessMsg(`❌ Error: ${error.message}`);
                } finally {
                  setSubmitting(false);
                  setTimeout(() => setSuccessMsg(''), 5000);
                }
              }}
              disabled={submitting}
            >
              {submitting ? 'Accepting...' : 'Accept Request'}
            </button>
            
            {/* Reject Request Button */}
            <button 
              className="action-btn" 
              style={{ background: '#e74c3c', color: 'white' }}
              onClick={async () => {
                try {
                  setSubmitting(true);
                          // Reject the request directly without quote
                          const response = await fetch(`http://localhost:5001/supplier-requests/${selectedRequest.id}/supplier-reject`, {
                            method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ supplier_id: supplierId })
                  });
                  const result = await response.json();
                  
                  if (result.success) {
                    setSuccessMsg('❌ Request rejected successfully');
                    // Refresh the requests list to show updated status
                    const requestsResponse = await fetch(`http://localhost:5001/supplier-requests/supplier/${supplierId}`);
                    const updatedRequests = await requestsResponse.json();
                    setRequests(updatedRequests);
                            // Refresh the selected request to get updated supplier statuses
                            const requestResponse = await fetch(`http://localhost:5001/supplier-requests/${selectedRequest.id}`);
                            const updatedRequest = await requestResponse.json();
                            setSelectedRequest(updatedRequest);
                  } else {
                    setSuccessMsg(`❌ Error: ${result.error}`);
                  }
                } catch (error) {
                  setSuccessMsg(`❌ Error: ${error.message}`);
                } finally {
                  setSubmitting(false);
                  setTimeout(() => setSuccessMsg(''), 5000);
                }
              }}
              disabled={submitting}
            >
              {submitting ? 'Rejecting...' : 'Reject Request'}
            </button>
            
                    {/* Send Revised Offer Button */}
                    <button 
                      className="action-btn" 
                      style={{ background: '#f59e42', color: 'white' }}
                      onClick={async () => {
                        try {
                          setSubmitting(true);
                          
                          // Calculate total amount from quote items
                          const totalAmount = selectedRequest.items.reduce((sum, item) => {
                            const itemPrice = quote[item.id] || item.unit_price || 0;
                            return sum + (itemPrice * item.quantity);
                          }, 0);
                          
                          // Prepare items for the revised offer
                          const offerItems = selectedRequest.items.map(item => ({
                            product_id: item.product_id,
                            quantity: item.quantity,
                            unit_price: quote[item.id] || item.unit_price || 0,
                            total_price: (quote[item.id] || item.unit_price || 0) * item.quantity,
                            specifications: item.specifications || '',
                            notes: item.notes || ''
                          }));
                          
                          // Send revised offer
                          const response = await fetch(`http://localhost:5001/supplier-requests/${selectedRequest.id}/supplier-revised-offer`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              supplier_id: supplierId,
                              total_amount: totalAmount,
                              notes: `Revised offer from supplier ${supplierId}`,
                              items: offerItems
                            })
                          });
                          const result = await response.json();
                          
                          if (result.success) {
                            setSuccessMsg('📝 Revised offer sent successfully! Admin will review and respond.');
                            // Refresh the requests list to show updated status
                            const requestsResponse = await fetch(`http://localhost:5001/supplier-requests/supplier/${supplierId}`);
                            const updatedRequests = await requestsResponse.json();
                            setRequests(updatedRequests);
                            // Refresh the selected request to get updated supplier statuses
                            const requestResponse = await fetch(`http://localhost:5001/supplier-requests/${selectedRequest.id}`);
                            const updatedRequest = await requestResponse.json();
                            setSelectedRequest(updatedRequest);
                          } else {
                            setSuccessMsg(`❌ Error: ${result.error}`);
                          }
                        } catch (error) {
                          setSuccessMsg(`❌ Error: ${error.message}`);
                        } finally {
                          setSubmitting(false);
                          setTimeout(() => setSuccessMsg(''), 5000);
                        }
                      }}
                      disabled={submitting}
                    >
                      {submitting ? 'Sending...' : 'Send Revised Offer'}
                    </button>
                  </>
                );
              }
              
              // Fallback for any other state
              return (
                <div style={{ 
                  background: '#f59e42', 
                  color: 'white', 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  width: '100%'
                }}>
                  ⏳ Request Status: {currentSupplier?.status || 'Unknown'}
                </div>
              );
            })()}
            
            {/* Submit/Revise Quote Button - Only show if current supplier has accepted */}
            {(() => {
              const currentSupplier = selectedRequest.suppliers?.find(s => s.id === supplierId);
              return currentSupplier?.status === 'accepted';
            })() && (
            <button 
              className="action-btn" 
              style={{ background: existingQuote ? '#f59e42' : '#3b82f6', color: 'white' }}
              onClick={() => {
                if (existingQuote) {
                  // Clear the existing quote to allow resubmission
                  setSubmittedQuotes(prev => prev.filter(q => q.id !== existingQuote.id));
                  setQuote({});
                  setSuccessMsg('📝 You can now submit a revised quote');
                } else {
                  // Submit new quote
                  handleSubmitQuote();
                }
              }}
              disabled={submitting}
            >
                {submitting ? 'Submitting...' : existingQuote ? 'Send Revised Quote' : 'Submit Quote (Optional)'}
            </button>
            )}
          </div>
          
          {/* Show status note */}
          {selectedRequest.status === 'pending' && (
            <div style={{ marginTop: 16, padding: '12px', borderRadius: '4px', background: '#2c3e50', color: '#ecf0f1', fontSize: 14 }}>
              💡 <strong>New Workflow:</strong> You can now accept, reject, or send a revised offer. Quote submission is optional and only available after accepting.
            </div>
          )}

          {/* Negotiation History Section */}
          <NegotiationHistory requestId={selectedRequest.id} supplierId={supplierId} />
          
                                {/* Show existing quote status if available */}
           {existingQuote && (
             <div style={{ marginTop: 16, fontWeight: 600, padding: '8px 12px', borderRadius: '4px', background: existingQuote.status === 'agreed' ? '#27ae60' : existingQuote.status === 'rejected' ? '#e74c3c' : '#f59e42', color: 'white' }}>
               {existingQuote.status === 'agreed' ? '✅ Quote Accepted by Admin' : 
                existingQuote.status === 'rejected' ? '❌ Quote Rejected' : 
                existingQuote.status === 'pending' ? '⏳ Quote Pending Review' : 
                '📝 Quote Submitted'}
             </div>
           )}
           
           {/* Show packing/dispatch buttons for accepted quotes */}
           {existingQuote && existingQuote.status === 'agreed' && (
             <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
               <h4 style={{ color: '#fff', margin: '0 0 12px 0', width: '100%' }}>Order Fulfillment:</h4>
               
               <button 
                 className="action-btn" 
                 style={{ background: '#f59e42', color: 'white' }}
                 onClick={async () => {
                   try {
                     setSubmitting(true);
                     const now = new Date().toISOString();
                     await fetch(`http://localhost:5001/supplier-request-quotes/${existingQuote.id}/status`, {
                       method: 'PUT',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ status: 'packing', packed_date: now })
                     });
                     setSuccessMsg('📦 Marked as packing');
                     // Refresh quotes
                     const quotesResponse = await fetch(`http://localhost:5001/supplier-request-quotes`);
                     const allQuotes = await quotesResponse.json();
                     setSubmittedQuotes(allQuotes.filter(q => q.supplier_id === supplierId));
                   } catch (error) {
                     setSuccessMsg(`❌ Error: ${error.message}`);
                   } finally {
                     setSubmitting(false);
                     setTimeout(() => setSuccessMsg(''), 5000);
                   }
                 }}
                 disabled={submitting}
               >
                 {submitting ? 'Updating...' : 'Mark as Packing'}
               </button>
               
               <button 
                 className="action-btn" 
                 style={{ background: '#3b82f6', color: 'white' }}
                 onClick={async () => {
                   try {
                     setSubmitting(true);
                     const now = new Date().toISOString();
                     await fetch(`http://localhost:5001/supplier-request-quotes/${existingQuote.id}/status`, {
                       method: 'PUT',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ status: 'dispatched', dispatched_date: now })
                     });
                     setSuccessMsg('🚚 Marked as dispatched');
                     // Refresh quotes
                     const quotesResponse = await fetch(`http://localhost:5001/supplier-request-quotes`);
                     const allQuotes = await quotesResponse.json();
                     setSubmittedQuotes(allQuotes.filter(q => q.supplier_id === supplierId));
                   } catch (error) {
                     setSuccessMsg(`❌ Error: ${error.message}`);
                   } finally {
                     setSubmitting(false);
                     setTimeout(() => setSuccessMsg(''), 5000);
                   }
                 }}
                 disabled={submitting}
               >
                 {submitting ? 'Updating...' : 'Mark as Dispatched'}
               </button>
             </div>
           )}
          {successMsg && (
            <div style={{ 
              color: 'white', 
              marginTop: 12, 
              padding: '8px 12px', 
              borderRadius: '4px',
              background: successMsg.includes('✅') ? '#27ae60' : successMsg.includes('❌') ? '#e74c3c' : '#f59e42',
              fontWeight: 'bold'
            }}>
              {successMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Material Modal Component
function MaterialModal({ material, onClose, onSave }) {
  const [form, setForm] = useState(material || { product_name: '', product_category: '', product_unit: '', unit_price: '', current_stock: 0 });
  const [error, setError] = useState('');
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = e => {
    e.preventDefault();
    if (!form.product_name || !form.unit_price) { setError('Name and price required'); return; }
    onSave(form);
  };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000a', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#181818', padding: 32, borderRadius: 16, minWidth: 320, color: '#fff', boxShadow: '0 2px 16px #000a' }}>
        <h2 style={{ marginBottom: 16 }}>{material ? 'Edit' : 'Add'} Material</h2>
        {error && <div style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</div>}
        <div style={{ marginBottom: 12 }}>
          <label>Name</label>
          <input name="product_name" value={form.product_name} onChange={handleChange} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Category</label>
          <input name="product_category" value={form.product_category} onChange={handleChange} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Unit</label>
          <input name="product_unit" value={form.product_unit} onChange={handleChange} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Price</label>
          <input name="unit_price" value={form.unit_price} onChange={handleChange} type="number" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Stock</label>
          <input name="current_stock" value={form.current_stock} onChange={handleChange} type="number" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="submit" className="action-btn">Save</button>
          <button type="button" className="action-btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function SupplierQuotesSection({ supplierId }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  useEffect(() => {
    if (!supplierId) return;
    setLoading(true);
    fetch(`http://localhost:5001/supplier-request-quotes`)
      .then(res => res.json())
      .then(data => {
        setQuotes(data.filter(q => q.supplier_id === supplierId));
        setLoading(false);
      });
  }, [supplierId]);
  if (loading) return <div style={{ color: '#bbb' }}>Loading quotes...</div>;
  if (quotes.length === 0) return <div style={{ color: '#bbb' }}>No quotes submitted yet.</div>;

  const allQuotesByRequest = {};
  quotes.forEach(q => {
    if (!allQuotesByRequest[q.request_id]) allQuotesByRequest[q.request_id] = [];
    allQuotesByRequest[q.request_id].push(q);
  });

  return (
    <>
      {successMsg && (
        <div style={{ 
          background: successMsg.includes('✅') ? '#27ae60' : '#e74c3c', 
          color: 'white', 
          padding: '12px', 
          borderRadius: '6px', 
          marginBottom: '16px',
          fontWeight: 'bold'
        }}>
          {successMsg}
        </div>
      )}
    <table style={{ width: '100%', color: '#fff', marginTop: 16 }}>
      <thead>
        <tr>
          <th>Request ID</th>
          <th>Fulfillment Date</th>
          <th>Total Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {quotes.map(q => {
          const isOrderAgreed = allQuotesByRequest[q.request_id]?.some(qq => qq.status === 'agreed');
          return (
            <tr key={q.id}>
              <td>{q.request_id}</td>
              <td>{q.fulfillment_date ? new Date(q.fulfillment_date).toLocaleDateString() : '-'}</td>
              <td>{q.total_amount}</td>
              <td>
                {isOrderAgreed && q.status !== 'agreed' ? (
                  <span style={{ color: '#aaa' }}>Order Expired</span>
                ) : q.status === 'agreed' ? (
                  <>
                    <span style={{color:'#27ae60', fontWeight:'bold', marginRight:8}}>✅ Accepted</span>
                    <button className="action-btn" style={{marginRight:8}} onClick={async () => {
                      const now = new Date().toISOString();
                      await fetch(`http://localhost:5001/supplier-request-quotes/${q.id}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'packing', packed_date: now })
                      });
                      setQuotes(quotes => quotes.map(qq => qq.id === q.id ? { ...qq, status: 'packing', packed_date: now } : qq));
                    }}>Mark as Packing</button>
                    <button className="action-btn" onClick={async () => {
                      const now = new Date().toISOString();
                      await fetch(`http://localhost:5001/supplier-request-quotes/${q.id}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'dispatched', dispatched_date: now })
                      });
                      setQuotes(quotes => quotes.map(qq => qq.id === q.id ? { ...qq, status: 'dispatched', dispatched_date: now } : qq));
                    }}>Mark as Dispatched</button>
                  </>
                ) : q.status === 'packing' ? (
                  <>
                    <span style={{color:'#f59e42', marginRight:8}}>Packing</span>
                    <button className="action-btn" onClick={async () => {
                      const now = new Date().toISOString();
                      await fetch(`http://localhost:5001/supplier-request-quotes/${q.id}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'dispatched', dispatched_date: now })
                      });
                      setQuotes(quotes => quotes.map(qq => qq.id === q.id ? { ...qq, status: 'dispatched', dispatched_date: now } : qq));
                    }}>Mark as Dispatched</button>
                  </>
                ) : q.status === 'dispatched' ? (
                  <span style={{color:'#3b82f6'}}>Dispatched</span>
                ) : (q.status === 'pending' || q.status === 'submitted') ? (
                  <>
                    <button className="action-btn" style={{marginRight:8, background: '#27ae60'}} onClick={async () => {
                      try {
                        // Accept this quote and reject all others for the same request
                        const response = await fetch(`http://localhost:5001/supplier-request-quotes/${q.id}/accept`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ supplier_id: supplierId })
                        });
                        const result = await response.json();
                        
                        if (result.success) {
                          setSuccessMsg(`✅ ${result.message}`);
                          // Clear success message after 5 seconds
                          setTimeout(() => setSuccessMsg(''), 5000);
                        } else {
                          setSuccessMsg(`❌ Error: ${result.error}`);
                          setTimeout(() => setSuccessMsg(''), 5000);
                        }
                        
                        // Refresh quotes to show updated statuses
                        const quotesResponse = await fetch(`http://localhost:5001/supplier-request-quotes`);
                        const allQuotes = await quotesResponse.json();
                        setQuotes(allQuotes.filter(q => q.supplier_id === supplierId));
                      } catch (error) {
                        setSuccessMsg(`❌ Error: ${error.message}`);
                        setTimeout(() => setSuccessMsg(''), 5000);
                      }
                    }}>Accept Quote</button>
                    <button className="action-btn" style={{marginRight:8}} onClick={async () => {
                      await fetch(`http://localhost:5001/supplier-request-quotes/${q.id}/status`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'rejected' })
                      });
                      setQuotes(quotes => quotes.map(qq => qq.id === q.id ? { ...qq, status: 'rejected' } : qq));
                    }}>Reject</button>
                    <span style={{color:'#f59e42'}}>Pending Review</span>
                  </>
                ) : q.status === 'rejected' ? (
                  <span style={{color:'#e74c3c'}}>Rejected</span>
                ) : (
                  q.status.charAt(0).toUpperCase() + q.status.slice(1)
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </>
  );
} 

function NegotiationHistory({ requestId, supplierId }) {
  const [negotiations, setNegotiations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const fetchNegotiations = async () => {
      try {
        const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/negotiations`);
        const data = await response.json();
        setNegotiations(data);
      } catch (error) {
        console.error('Error fetching negotiations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNegotiations();
  }, [requestId]);

  if (loading) return <div style={{ color: '#bbb', marginTop: 16 }}>Loading negotiation history...</div>;

  if (!Array.isArray(negotiations)) {
    return <div style={{ color: '#e74c3c', margin: 16 }}>Failed to load negotiations. Please try again later.</div>;
  }

  if (negotiations.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h4 style={{ color: '#fff', marginBottom: 12 }}>Negotiation History:</h4>
      <div style={{ background: '#181818', borderRadius: 12, padding: 16 }}>
        {negotiations.map((negotiation, index) => (
          <div key={negotiation.id} style={{ 
            border: '1px solid #333', 
            borderRadius: 8, 
            padding: 16, 
            marginBottom: 12,
            background: negotiation.supplier_id === supplierId ? '#2c3e50' : '#1a1a1a'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ color: '#fff', fontWeight: 600 }}>
                {negotiation.offer_type === 'revised_offer' ? '📝 Revised Offer' : '💼 Counter Offer'}
                {negotiation.supplier_id === supplierId ? ' (You)' : ` (${negotiation.supplier_name})`}
              </div>
              <div style={{ 
                padding: '4px 8px', 
                borderRadius: '4px', 
                fontSize: '12px',
                background: negotiation.status === 'accepted' ? '#27ae60' : 
                           negotiation.status === 'rejected' ? '#e74c3c' : '#f59e42',
                color: 'white'
              }}>
                {negotiation.status}
              </div>
            </div>
            
            <div style={{ color: '#ccc', marginBottom: 8 }}>
              <strong>Total Amount:</strong> ₹{negotiation.total_amount}
            </div>
            
            {negotiation.notes && (
              <div style={{ color: '#ccc', marginBottom: 8 }}>
                <strong>Notes:</strong> {negotiation.notes}
              </div>
            )}
            
            <div style={{ color: '#999', fontSize: '12px' }}>
              {new Date(negotiation.created_at).toLocaleString()}
            </div>

            {/* Show items for this negotiation */}
            {negotiation.items && negotiation.items.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ color: '#ccc', marginBottom: 8, fontWeight: 600 }}>Items:</div>
                <table style={{ width: '100%', color: '#ccc', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Product</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negotiation.items.map(item => (
                      <tr key={item.id}>
                        <td>{item.product_name}</td>
                        <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.unit_price}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.total_price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Show action buttons for counter offers received by this supplier */}
            {negotiation.offer_type === 'counter_offer' && 
             negotiation.supplier_id === supplierId && 
             negotiation.status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button 
                  className="action-btn" 
                  style={{ background: '#27ae60', color: 'white', fontSize: '12px', padding: '6px 12px' }}
                  onClick={async () => {
                    try {
                      setSubmitting(true);
                      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/supplier-accept`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ supplier_id: supplierId })
                      });
                      const result = await response.json();
                      
                      if (result.success) {
                        setSuccessMsg('✅ Counter offer accepted!');
                        // Refresh negotiations
                        const negotiationsResponse = await fetch(`http://localhost:5001/supplier-requests/${requestId}/negotiations`);
                        const updatedNegotiations = await negotiationsResponse.json();
                        setNegotiations(updatedNegotiations);
                      } else {
                        setSuccessMsg(`❌ Error: ${result.error}`);
                      }
                    } catch (error) {
                      setSuccessMsg(`❌ Error: ${error.message}`);
                    } finally {
                      setSubmitting(false);
                      setTimeout(() => setSuccessMsg(''), 5000);
                    }
                  }}
                  disabled={submitting}
                >
                  {submitting ? 'Accepting...' : 'Accept Counter Offer'}
                </button>
                
                <button 
                  className="action-btn" 
                  style={{ background: '#e74c3c', color: 'white', fontSize: '12px', padding: '6px 12px' }}
                  onClick={async () => {
                    try {
                      setSubmitting(true);
                      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/supplier-reject`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ supplier_id: supplierId })
                      });
                      const result = await response.json();
                      
                      if (result.success) {
                        setSuccessMsg('❌ Counter offer rejected');
                        // Refresh negotiations
                        const negotiationsResponse = await fetch(`http://localhost:5001/supplier-requests/${requestId}/negotiations`);
                        const updatedNegotiations = await negotiationsResponse.json();
                        setNegotiations(updatedNegotiations);
                      } else {
                        setSuccessMsg(`❌ Error: ${result.error}`);
                      }
                    } catch (error) {
                      setSuccessMsg(`❌ Error: ${error.message}`);
                    } finally {
                      setSubmitting(false);
                      setTimeout(() => setSuccessMsg(''), 5000);
                    }
                  }}
                  disabled={submitting}
                >
                  {submitting ? 'Rejecting...' : 'Reject Counter Offer'}
                </button>
              </div>
            )}
          </div>
        ))}
        
        {successMsg && (
          <div style={{ 
            marginTop: 12, 
            padding: '8px 12px', 
            borderRadius: '4px', 
            background: successMsg.includes('✅') ? '#27ae60' : '#e74c3c', 
            color: 'white',
            fontSize: '14px'
          }}>
            {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}

// Handler to open the accept modal and fetch breakdown
const handleAcceptClick = async (req) => {
  setAcceptModal({ open: true, request: req, breakdown: null });
  // Fetch breakdown from backend
  try {
    const subtotal = req.total_amount || 0;
    const res = await fetch(
      `http://localhost:5001/supplier-shipping-cost/${user.id}?delivery_address=${encodeURIComponent(req.delivery_address || '')}&subtotal=${subtotal}&product_category=machinery`
    );
    if (res.ok) {
      const breakdown = await res.json();
      setAcceptModal({ open: true, request: req, breakdown });
    }
  } catch (e) {
    setAcceptModal({ open: true, request: req, breakdown: { error: 'Failed to fetch cost breakdown.' } });
  }
};

// Handler to confirm acceptance
const handleConfirmAccept = async () => {
  if (!acceptModal.request) return;
  try {
    const res = await fetch(`http://localhost:5001/supplier-requests/${acceptModal.request.id}/supplier-accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_id: user.id })
    });
    const data = await res.json();
    if (data.success) {
      setAcceptModal({ open: false, request: null, breakdown: null });
      fetchRequests(); // Refresh
    } else {
      setAcceptModal((m) => ({ ...m, breakdown: { error: data.error || 'Failed to accept.' } }));
    }
  } catch (e) {
    setAcceptModal((m) => ({ ...m, breakdown: { error: 'Failed to accept.' } }));
  }
};

