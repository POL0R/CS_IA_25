import React, { useState, useEffect } from 'react';

const ManagerRequests = () => {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [transporterId, setTransporterId] = useState('');
  const [negotiationHistory, setNegotiationHistory] = useState([]);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const manager_id = 1; // TODO: Replace with real user session

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = () => {
    fetch('http://localhost:5001/customer_requests?status=')
      .then(res => res.json())
      .then(setRequests);
  };

  // Fetch negotiation history for a request
  const fetchNegotiationHistory = async (requestId) => {
    try {
      const res = await fetch(`http://localhost:5001/customer_requests/${requestId}/negotiations`);
      if (res.ok) {
        const data = await res.json();
        setNegotiationHistory(data.negotiations || []);
      } else {
        setNegotiationHistory([]);
      }
    } catch {
      setNegotiationHistory([]);
    }
  };

  // When selecting a request, fetch negotiation history
  const handleSelect = (id) => {
    setSelected(id);
    fetchNegotiationHistory(id);
  };

  // Admin responds to a customer offer
  const handleNegotiationAction = async (action, negotiation) => {
    setNegotiationLoading(true);
    try {
      let body = { negotiation_id: negotiation.id, action };
      if (action === 'counter') {
        if (!counterAmount || isNaN(Number(counterAmount))) {
          alert('Enter a valid counter-offer amount.');
          setNegotiationLoading(false);
          return;
        }
        body.counter_offer = {
          total_amount: Number(counterAmount),
          items: [{
            product_id: negotiation.items[0]?.product_id,
            quantity: negotiation.items[0]?.quantity,
            unit_price: Number(counterAmount) / (negotiation.items[0]?.quantity || 1),
            total_price: Number(counterAmount),
            specifications: negotiation.items[0]?.specifications || '',
            notes: counterNotes
          }]
        };
        body.notes = counterNotes;
      }
      const res = await fetch(`http://localhost:5001/customer_requests/${selected}/admin-respond-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        alert('Action submitted!');
        setCounterAmount('');
        setCounterNotes('');
        fetchNegotiationHistory(selected);
        fetchRequests();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setNegotiationLoading(false);
    }
  };

  const handleReview = async (req) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5001/customer_requests/${req.id}/manager_review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id, notes })
      });
      
      if (response.ok) {
        alert('Request marked as reviewed successfully!');
        setNotes('');
        fetchRequests();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuote = async (req) => {
    if (!quote || isNaN(Number(quote))) {
      alert('Please enter a valid quote price');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5001/customer_requests/${req.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoted_price: Number(quote), notes })
      });
      
      if (response.ok) {
        alert('Quote submitted successfully!');
        setQuote('');
        setNotes('');
        fetchRequests();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTransporter = async (req) => {
    if (!transporterId || isNaN(Number(transporterId))) {
      alert('Please enter a valid transporter ID');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5001/customer_requests/${req.id}/assign_transporter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transporter_id: Number(transporterId), notes })
      });
      
      if (response.ok) {
        alert('Transporter assigned successfully!');
        setTransporterId('');
        setNotes('');
        fetchRequests();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    const statusColors = {
      'submitted': '#f59e42',
      'manager_review': '#17a2b8',
      'quoted': '#007bff',
      'customer_accepted': '#28a745',
      'customer_declined': '#e74c3c',
      'in_transit': '#6f42c1',
      'completed': '#20c997'
    };
    return statusColors[status] || '#6c757d';
  };

  const getStatusDisplayText = (status) => {
    const statusTexts = {
      'submitted': 'Submitted',
      'manager_review': 'Under Review',
      'quoted': 'Quote Sent',
      'customer_accepted': 'Accepted',
      'customer_declined': 'Declined',
      'in_transit': 'In Transit',
      'completed': 'Completed'
    };
    return statusTexts[status] || status;
  };

  const getCustomerResponseColor = (response) => {
    const responseColors = {
      'accepted': '#28a745',
      'declined': '#e74c3c',
      'revision_requested': '#f59e42'
    };
    return responseColors[response] || '#6c757d';
  };

  const getCustomerResponseText = (response) => {
    const responseTexts = {
      'accepted': 'Accepted',
      'declined': 'Declined',
      'revision_requested': 'Revision Requested'
    };
    return responseTexts[response] || response || 'No Response';
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>
      <h2>Manager: Customer Requests</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr style={{ background: '#f8f9fa' }}>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>ID</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Customer</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Product</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Quantity</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Expected Delivery</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Status</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Quoted Price</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Customer Response</th>
            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id} style={{ 
              background: selected === r.id ? '#f1f5f9' : undefined,
              borderBottom: '1px solid #dee2e6'
            }}>
              <td style={{ padding: '12px' }}>{r.id}</td>
              <td style={{ padding: '12px' }}>{r.customer_name}</td>
              <td style={{ padding: '12px' }}>{r.product_name}</td>
              <td style={{ padding: '12px' }}>{r.quantity}</td>
              <td style={{ padding: '12px' }}>{r.expected_delivery?.slice(0, 10) || 'Not specified'}</td>
              <td style={{ padding: '12px' }}>
                <span style={{ 
                  background: getStatusBadgeColor(r.status), 
                  color: 'white', 
                  padding: '4px 8px', 
                  borderRadius: 12, 
                  fontSize: 12, 
                  fontWeight: 600 
                }}>
                  {getStatusDisplayText(r.status)}
                </span>
              </td>
              <td style={{ padding: '12px' }}>
                {r.quoted_price ? `₹${r.quoted_price}` : '-'}
              </td>
              <td style={{ padding: '12px' }}>
                {r.customer_response ? (
                  <span style={{ 
                    background: getCustomerResponseColor(r.customer_response), 
                    color: 'white', 
                    padding: '4px 8px', 
                    borderRadius: 12, 
                    fontSize: 12, 
                    fontWeight: 600 
                  }}>
                    {getCustomerResponseText(r.customer_response)}
                  </span>
                ) : '-'}
              </td>
              <td style={{ padding: '12px' }}>
                <button 
                  onClick={() => handleSelect(r.id)}
                  style={{
                    background: '#457b9d',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Select
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {selected && (
        <div style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: 8, 
          padding: 24, 
          marginBottom: 32,
          background: '#f8f9fa'
        }}>
          <h3 style={{ marginBottom: 16, color: '#1d3557' }}>Manage Request #{selected}</h3>
          
          {/* Negotiation History */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: '#457b9d', marginBottom: 8 }}>Negotiation History</h4>
            {negotiationHistory.length === 0 ? (
              <div style={{ color: '#888', fontSize: 13 }}>No negotiation rounds yet.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {negotiationHistory.map((n, idx) => (
                  <li key={n.id} style={{ marginBottom: 8, background: '#fff', borderRadius: 6, padding: 8 }}>
                    <div style={{ fontWeight: 600, color: n.offer_type === 'admin_counter' ? '#e67e22' : '#1976d2' }}>
                      {n.offer_type === 'admin_counter' ? 'Admin Counter-Offer' : 'Customer Offer'}
                      {n.status === 'accepted' && <span style={{ color: '#28a745', marginLeft: 8 }}>(Accepted)</span>}
                      {n.status === 'rejected' && <span style={{ color: '#e74c3c', marginLeft: 8 }}>(Rejected)</span>}
                      {n.status === 'pending' && <span style={{ color: '#f59e42', marginLeft: 8 }}>(Pending)</span>}
                    </div>
                    <div>Amount: <b>₹{n.total_amount}</b></div>
                    <div style={{ fontSize: 12, color: '#555' }}>{n.notes}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{new Date(n.created_at).toLocaleString()}</div>
                    {/* Admin actions for pending customer offer */}
                    {n.offer_type === 'customer_offer' && n.status === 'pending' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button onClick={() => handleNegotiationAction('accept', n)} disabled={negotiationLoading} style={{ background: '#28a745', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', fontWeight: 600 }}>Accept</button>
                        <button onClick={() => handleNegotiationAction('reject', n)} disabled={negotiationLoading} style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', fontWeight: 600 }}>Reject</button>
                        <input type="number" placeholder="Counter Amount" value={counterAmount} onChange={e => setCounterAmount(e.target.value)} style={{ width: 120, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }} />
                        <input type="text" placeholder="Counter Notes" value={counterNotes} onChange={e => setCounterNotes(e.target.value)} style={{ width: 160, padding: '4px 8px', border: '1px solid #ddd', borderRadius: 4 }} />
                        <button onClick={() => handleNegotiationAction('counter', n)} disabled={negotiationLoading} style={{ background: '#007bff', color: 'white', border: 'none', borderRadius: 4, padding: '6px 12px', fontWeight: 600 }}>Counter</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
              Manager Notes:
            </label>
            <textarea 
              value={notes} 
              onChange={e => setNotes(e.target.value)} 
              placeholder="Add manager notes, comments, or instructions..."
              style={{ 
                width: '100%', 
                minHeight: 80, 
                padding: 12, 
                border: '1px solid #ddd', 
                borderRadius: 4, 
                resize: 'vertical' 
              }} 
            />
          </div>
          
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button 
              onClick={() => handleReview(requests.find(r => r.id === selected))} 
              disabled={loading}
              style={{
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '8px 16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Processing...' : 'Mark as Reviewed'}
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="number" 
                placeholder="Quote Price (₹)" 
                value={quote} 
                onChange={e => setQuote(e.target.value)} 
                style={{ 
                  width: 150, 
                  padding: '8px 12px', 
                  border: '1px solid #ddd', 
                  borderRadius: 4 
                }} 
              />
              <button 
                onClick={() => handleQuote(requests.find(r => r.id === selected))} 
                disabled={loading || !quote}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: (loading || !quote) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !quote) ? 0.6 : 1
                }}
              >
                {loading ? 'Submitting...' : 'Submit Quote'}
              </button>
            </div>
          </div>
          
          {requests.find(r => r.id === selected)?.status === 'customer_accepted' && (
            <div style={{ 
              borderTop: '1px solid #dee2e6', 
              paddingTop: 16, 
              marginTop: 16 
            }}>
              <h4 style={{ marginBottom: 12, color: '#28a745' }}>Assign Transporter</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input 
                  type="number" 
                  placeholder="Transporter ID" 
                  value={transporterId} 
                  onChange={e => setTransporterId(e.target.value)} 
                  style={{ 
                    width: 150, 
                    padding: '8px 12px', 
                    border: '1px solid #ddd', 
                    borderRadius: 4 
                  }} 
                />
                <button 
                  onClick={() => handleAssignTransporter(requests.find(r => r.id === selected))} 
                  disabled={loading || !transporterId}
                  style={{
                    background: '#6f42c1',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '8px 16px',
                    fontWeight: 600,
                    cursor: (loading || !transporterId) ? 'not-allowed' : 'pointer',
                    opacity: (loading || !transporterId) ? 0.6 : 1
                  }}
                >
                  {loading ? 'Assigning...' : 'Assign Transporter'}
                </button>
              </div>
            </div>
          )}
          
          <div style={{ marginTop: 16 }}>
            <button 
              onClick={() => setSelected(null)}
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '8px 16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerRequests; 