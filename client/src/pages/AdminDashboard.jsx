import React, { useEffect, useState } from 'react';

const PRIORITY_COLORS = {
  critical: '#fee2e2', // red-100
  high: '#fef3c7',    // orange-100
  medium: '#fef9c3',  // yellow-100
  low: '#dcfce7',     // green-100
};
const PRIORITY_TEXT = {
  critical: '#b91c1c',
  high: '#b45309',
  medium: '#a16207',
  low: '#15803d',
};

export default function AdminDashboard() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customerRequests, setCustomerRequests] = useState([]);
  const [customerRequestsLoading, setCustomerRequestsLoading] = useState(true);
  const [applicationTags, setApplicationTags] = useState([]);
  const [showApplicationTagModal, setShowApplicationTagModal] = useState(false);
  const [editingApplicationTag, setEditingApplicationTag] = useState(null);

  const fetchApplicationTags = () => {
    fetch('http://localhost:5001/application-tags')
      .then(res => res.json())
      .then(data => setApplicationTags(data))
      .catch(() => setApplicationTags([]));
  };

  useEffect(() => {
    fetch('http://localhost:5001/requisitions/aggregate')
      .then(res => res.json())
      .then(data => setSuggestions(data))
      .finally(() => setLoading(false));
    fetch('http://localhost:5001/customer_requests')
      .then(res => {
        console.log('Customer requests response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        console.log('Customer requests data:', data);
        setCustomerRequests(data);
      })
      .catch(error => {
        console.error('Error fetching customer requests:', error);
        setCustomerRequests([]);
      })
      .finally(() => setCustomerRequestsLoading(false));
    fetchApplicationTags();
  }, []);

  const handleOrderAction = (requestId, action) => {
    let url = '';
    let method = 'POST';
    let body = {};
    
    switch (action) {
      case 'approve':
        url = `http://localhost:5001/customer_requests/${requestId}/manager_review`;
        body = { manager_id: 1, notes: 'Request approved by admin' };
        break;
      case 'reject':
        url = `http://localhost:5001/customer_requests/${requestId}/manager_review`;
        body = { manager_id: 1, notes: 'Request rejected by admin' };
        break;
      case 'quote':
        url = `http://localhost:5001/customer_requests/${requestId}/quote`;
        body = { quoted_price: 0 }; // This should be updated with actual price
        break;
      default:
        alert(`Unknown action: ${action}`);
        return;
    }
    
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(res => {
        if (!res.ok) throw new Error(`Failed to ${action} request`);
        return res.json();
      })
      .then(() => {
        alert(`Successfully ${action}ed customer request #${requestId}`);
        // Refresh the customer requests list
        fetch('http://localhost:5001/customer_requests')
          .then(res => res.json())
          .then(data => setCustomerRequests(data))
          .catch(() => console.error('Failed to refresh customer requests'));
      })
      .catch(error => {
        console.error(`Error ${action}ing request:`, error);
        alert(`Failed to ${action} customer request: ${error.message}`);
      });
  };

  const handleAddApplicationTag = (tagData) => {
    fetch("http://localhost:5001/application-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tagData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to add application tag");
        return res.json();
      })
      .then(() => {
        fetchApplicationTags();
        setShowApplicationTagModal(false);
      })
      .catch(() => alert("Failed to add application tag. Tag name may already exist."));
  };

  const handleEditApplicationTag = (tagData) => {
    fetch(`http://localhost:5001/application-tags/${editingApplicationTag.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tagData)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update application tag");
        return res.json();
      })
      .then(() => {
        fetchApplicationTags();
        setEditingApplicationTag(null);
        setShowApplicationTagModal(false);
      })
      .catch(() => alert("Failed to update application tag."));
  };

  const handleDeleteApplicationTag = (id) => {
    if (window.confirm("Are you sure you want to delete this application tag?")) {
      fetch(`http://localhost:5001/application-tags/${id}`, {
        method: "DELETE"
      })
        .then(res => {
          if (!res.ok) throw new Error("Failed to delete application tag");
          return res.json();
        })
        .then(() => fetchApplicationTags())
        .catch(() => alert("Failed to delete application tag."));
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Admin Dashboard</h1>
      
      {/* Application Tags Section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>Application Tags Management</h2>
          <button 
            onClick={() => setShowApplicationTagModal(true)}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '10px 16px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add Application Tag
          </button>
        </div>
        
        <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(60,60,120,0.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#222' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Application Tag</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applicationTags && applicationTags.length > 0 ? (
                applicationTags.map(tag => (
                  <tr key={tag.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px 16px' }}>{tag.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button 
                        onClick={() => { setEditingApplicationTag(tag); setShowApplicationTagModal(true); }}
                        style={{
                          background: '#f59e0b',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '6px 12px',
                          marginRight: 8,
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteApplicationTag(tag.id)}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          padding: '6px 12px',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="2" style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                    No application tags found. Add your first application tag above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Consolidated Purchase Suggestions</h2>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(60,60,120,0.07)' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', color: '#222' }}>
              <th style={{ padding: '12px 10px', textAlign: 'left' }}>Product</th>
              <th style={{ padding: '12px 10px', textAlign: 'left' }}>Total Qty</th>
              <th style={{ padding: '12px 10px', textAlign: 'left' }}>Departments</th>
              <th style={{ padding: '12px 10px', textAlign: 'left' }}>Priority</th>
              <th style={{ padding: '12px 10px', textAlign: 'left' }}>Earliest Request</th>
              <th style={{ padding: '12px 10px', textAlign: 'left' }}>Suggested Supplier</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s, i) => (
              <tr key={i} style={{ background: PRIORITY_COLORS[s.priority] || '#fff', color: PRIORITY_TEXT[s.priority] || '#222', fontWeight: s.priority === 'critical' ? 700 : 500 }}>
                <td style={{ padding: '10px 10px', fontWeight: 600 }}>{s.product_name || s.product_id}</td>
                <td style={{ padding: '10px 10px' }}>{s.total_quantity}</td>
                <td style={{ padding: '10px 10px' }}>{s.requested_by.join(', ')}</td>
                <td style={{ padding: '10px 10px', textTransform: 'capitalize' }}>{s.priority}</td>
                <td style={{ padding: '10px 10px' }}>{s.earliest_request ? new Date(s.earliest_request).toLocaleString() : ''}</td>
                <td style={{ padding: '10px 10px' }}>{s.suggested_supplier || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 24, fontWeight: 700, margin: '40px 0 16px 0' }}>Customer Requests</h2>
      <div style={{ color: '#666', marginBottom: 16 }}>Debug: {customerRequestsLoading ? 'Loading...' : `Found ${customerRequests.length} requests`}</div>
      {customerRequestsLoading ? (
        <div>Loading customer requests...</div>
      ) : customerRequests.length === 0 ? (
        <div style={{ color: '#888', marginBottom: 16 }}>No customer requests yet.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {customerRequests.map(request => (
            <div key={request.id} style={{
              background: '#000',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(60,60,120,0.10)',
              padding: 24,
              minWidth: 320,
              maxWidth: 360,
              flex: '1 1 320px',
              display: 'flex',
              flexDirection: 'column',
              marginBottom: 16
            }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Request #{request.id}</div>
              <div style={{ marginBottom: 6 }}><b>Status:</b> <span style={{ textTransform: 'capitalize', color: request.status === 'submitted' ? '#fbbf24' : request.status === 'approved' ? '#10b981' : '#ef4444' }}>{request.status}</span></div>
              <div style={{ marginBottom: 6 }}><b>Customer:</b> {request.customer_name || request.customer_id}</div>
              <div style={{ marginBottom: 6 }}><b>Product:</b> {request.product_name || request.product_id}</div>
              <div style={{ marginBottom: 6 }}><b>Quantity:</b> {request.quantity}</div>
              <div style={{ marginBottom: 6 }}><b>Created:</b> {request.created_at ? request.created_at.slice(0, 19).replace('T', ' ') : ''}</div>
              <div style={{ marginBottom: 6 }}><b>Expected Delivery:</b> {request.expected_delivery ? request.expected_delivery.slice(0, 19).replace('T', ' ') : '-'}</div>
              <div style={{ marginBottom: 6 }}><b>Delivery Address:</b> {request.delivery_address || '-'}</div>
              <div style={{ marginBottom: 6 }}><b>Quoted Price:</b> {request.quoted_price ? `₹${request.quoted_price}` : 'Not quoted yet'}</div>
              <div style={{ marginBottom: 6 }}><b>Notes:</b> {request.notes || '-'}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button onClick={() => handleOrderAction(request.id, 'approve')} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>Approve</button>
                <button onClick={() => handleOrderAction(request.id, 'reject')} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>Reject</button>
                <button onClick={() => handleOrderAction(request.id, 'quote')} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>Quote</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Application Tag Modal */}
      {showApplicationTagModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 8,
            padding: 24,
            width: '90%',
            maxWidth: 500,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 600 }}>
                {editingApplicationTag ? 'Edit Application Tag' : 'Add New Application Tag'}
              </h3>
              <button 
                onClick={() => { setShowApplicationTagModal(false); setEditingApplicationTag(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            <ApplicationTagForm
              tag={editingApplicationTag}
              onSubmit={editingApplicationTag ? handleEditApplicationTag : handleAddApplicationTag}
              onCancel={() => { setShowApplicationTagModal(false); setEditingApplicationTag(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Application Tag Form Component
function ApplicationTagForm({ tag, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: tag?.name || ""
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
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
          Application Tag Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder="Enter application tag name"
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 14
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button 
          type="button" 
          onClick={onCancel}
          style={{
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '10px 16px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button 
          type="submit"
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: '10px 16px',
            cursor: 'pointer'
          }}
        >
          {tag ? 'Update Application Tag' : 'Add Application Tag'}
        </button>
      </div>
    </form>
  );
} 