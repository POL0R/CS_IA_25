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

  useEffect(() => {
    fetch('http://localhost:5001/requisitions/aggregate')
      .then(res => res.json())
      .then(data => setSuggestions(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Consolidated Purchase Suggestions</h1>
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
    </div>
  );
} 