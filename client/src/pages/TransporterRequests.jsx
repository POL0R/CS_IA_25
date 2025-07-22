import React, { useState, useEffect } from 'react';

const TransporterRequests = () => {
  const [requests, setRequests] = useState([]);
  const transporter_id = 1; // TODO: Replace with real user session

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = () => {
    fetch('http://localhost:5001/customer_requests?status=in_transit')
      .then(res => res.json())
      .then(data => setRequests(data.filter(r => r.transporter_id === transporter_id)));
  };

  const handleComplete = async (req_id) => {
    await fetch(`http://localhost:5001/customer_requests/${req_id}/mark_completed`, { method: 'POST' });
    fetchRequests();
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
      <h2>Transporter: Assigned Deliveries</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Expected Delivery</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.customer_name}</td>
              <td>{r.product_name}</td>
              <td>{r.quantity}</td>
              <td>{r.expected_delivery?.slice(0, 10)}</td>
              <td>{r.status}</td>
              <td>
                <button onClick={() => handleComplete(r.id)}>Mark Completed</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransporterRequests; 