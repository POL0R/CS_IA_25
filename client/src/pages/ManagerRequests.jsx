import React, { useState, useEffect } from 'react';

const ManagerRequests = () => {
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quote, setQuote] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [transporterId, setTransporterId] = useState('');
  const manager_id = 1; // TODO: Replace with real user session

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = () => {
    fetch('http://localhost:5001/customer_requests?status=')
      .then(res => res.json())
      .then(setRequests);
  };

  const handleReview = async (req) => {
    setLoading(true);
    await fetch(`http://localhost:5001/customer_requests/${req.id}/manager_review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manager_id, notes })
    });
    setNotes('');
    fetchRequests();
  };

  const handleQuote = async (req) => {
    setLoading(true);
    await fetch(`http://localhost:5001/customer_requests/${req.id}/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoted_price: Number(quote), notes })
    });
    setQuote('');
    setNotes('');
    fetchRequests();
  };

  const handleAssignTransporter = async (req) => {
    setLoading(true);
    await fetch(`http://localhost:5001/customer_requests/${req.id}/assign_transporter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transporter_id: Number(transporterId), notes })
    });
    setTransporterId('');
    setNotes('');
    fetchRequests();
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
      <h2>Manager: Customer Requests</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 32 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Expected Delivery</th>
            <th>Status</th>
            <th>Quoted Price</th>
            <th>Response</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id} style={{ background: selected === r.id ? '#f1f5f9' : undefined }}>
              <td>{r.id}</td>
              <td>{r.customer_name}</td>
              <td>{r.product_name}</td>
              <td>{r.quantity}</td>
              <td>{r.expected_delivery?.slice(0, 10)}</td>
              <td>{r.status}</td>
              <td>{r.quoted_price ? `$${r.quoted_price}` : '-'}</td>
              <td>{r.customer_response || '-'}</td>
              <td>
                <button onClick={() => setSelected(r.id)}>Select</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 32 }}>
          <h3>Review/Quote for Request #{selected}</h3>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Manager notes" style={{ width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleReview(requests.find(r => r.id === selected))} disabled={loading}>Mark as Reviewed</button>
            <input type="number" placeholder="Quote Price" value={quote} onChange={e => setQuote(e.target.value)} style={{ width: 120 }} />
            <button onClick={() => handleQuote(requests.find(r => r.id === selected))} disabled={loading}>Quote Price</button>
            <button onClick={() => setSelected(null)}>Cancel</button>
          </div>
          {requests.find(r => r.id === selected)?.status === 'customer_accepted' && (
            <div style={{ marginTop: 16 }}>
              <input type="number" placeholder="Transporter ID" value={transporterId} onChange={e => setTransporterId(e.target.value)} style={{ width: 120 }} />
              <button onClick={() => handleAssignTransporter(requests.find(r => r.id === selected))} disabled={loading || !transporterId}>Assign Transporter</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManagerRequests; 