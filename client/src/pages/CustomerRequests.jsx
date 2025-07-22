import React, { useState, useEffect } from 'react';

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

const CustomerRequests = () => {
  const user = getUser();
  const isCustomer = user && user.role === 'customer';

  // Smart order UI state
  const [reqForm, setReqForm] = useState({
    application: '',
    power_load_kw: '',
    voltage_rating: '',
    phase_type: '',
    mount_type: '',
    compliance: '',
    preferred_features: ''
  });
  const [recommendations, setRecommendations] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [orderQty, setOrderQty] = useState(1);
  const [includeInstall, setIncludeInstall] = useState(false);
  const [orderStatus, setOrderStatus] = useState('');
  const [orderError, setOrderError] = useState('');
  const [loading, setLoading] = useState(false);

  // Old request state
  const [products, setProducts] = useState([]); // This will now be finished products only
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ product_id: '', quantity: '', expected_delivery: '', notes: '' });
  const [error, setError] = useState('');
  const customer_id = user?.user_id || 1;

  useEffect(() => {
    fetch('http://localhost:5001/finished_products').then(res => res.json()).then(data => {
      // Normalize to { id, name } for dropdown
      setProducts(Array.isArray(data) ? data.map(fp => ({ id: fp.id, name: fp.model_name })) : []);
    });
    fetchRequests();
  }, []);

  const fetchRequests = () => {
    fetch('http://localhost:5001/customer_requests?status=')
      .then(res => res.json())
      .then(data => setRequests(data.filter(r => r.customer_id === customer_id)));
  };

  // --- Smart Order Handlers ---
  const handleReqFormChange = e => {
    setReqForm({ ...reqForm, [e.target.name]: e.target.value });
  };
  const handleReqFormArrayChange = e => {
    setReqForm({ ...reqForm, [e.target.name]: e.target.value.split(',').map(s => s.trim()).filter(Boolean) });
  };
  const handleGetRecommendations = async e => {
    e.preventDefault();
    setRecommendations([]);
    setSelectedProduct(null);
    setPriceBreakdown(null);
    setOrderStatus('');
    setOrderError('');
    setLoading(true);
    try {
      const payload = {
        ...reqForm,
        power_load_kw: Number(reqForm.power_load_kw),
        voltage_rating: Number(reqForm.voltage_rating),
        compliance: Array.isArray(reqForm.compliance) ? reqForm.compliance : reqForm.compliance.split(',').map(s => s.trim()).filter(Boolean),
        preferred_features: Array.isArray(reqForm.preferred_features) ? reqForm.preferred_features : reqForm.preferred_features.split(',').map(s => s.trim()).filter(Boolean)
      };
      const res = await fetch('http://localhost:5001/match-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setRecommendations(data);
    } catch (err) {
      setOrderError('Failed to get recommendations');
    } finally {
      setLoading(false);
    }
  };
  const handleSelectProduct = async (product) => {
    setSelectedProduct(product);
    setOrderQty(1);
    setIncludeInstall(false);
    setPriceBreakdown(null);
    setOrderStatus('');
    setOrderError('');
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/price-breakdown?product_id=${product.product_id}&qty=1&install=false`);
      const data = await res.json();
      setPriceBreakdown(data);
    } catch (err) {
      setOrderError('Failed to get price breakdown');
    } finally {
      setLoading(false);
    }
  };
  const handlePriceBreakdown = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setOrderStatus('');
    setOrderError('');
    try {
      const res = await fetch(`http://localhost:5001/price-breakdown?product_id=${selectedProduct.product_id}&qty=${orderQty}&install=${includeInstall}`);
      const data = await res.json();
      setPriceBreakdown(data);
    } catch (err) {
      setOrderError('Failed to get price breakdown');
    } finally {
      setLoading(false);
    }
  };
  const handlePlaceOrder = async () => {
    setLoading(true);
    setOrderStatus('');
    setOrderError('');
    try {
      const orderPayload = {
        customer_id,
        items: [{ product_id: selectedProduct.product_id, quantity: orderQty, unit_price: priceBreakdown.product_base_price / orderQty }],
        notes: 'Ordered via smart customer dashboard'
      };
      const res = await fetch('http://localhost:5001/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (data.success) {
        setOrderStatus('Order placed successfully! Order ID: ' + data.order_id);
        setSelectedProduct(null);
        setPriceBreakdown(null);
        fetchRequests();
      } else {
        setOrderError(data.error || 'Failed to place order');
      }
    } catch (err) {
      setOrderError('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  // --- Old request handlers (unchanged) ---
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:5001/customer_requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, customer_id, quantity: Number(form.quantity) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      setForm({ product_id: '', quantity: '', expected_delivery: '', notes: '' });
      fetchRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleRespond = async (req_id, response) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5001/customer_requests/${req_id}/customer_response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to respond');
      fetchRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Render ---
  if (!isCustomer) {
    return <div style={{ padding: 32, color: 'red', fontWeight: 600 }}>Access denied. This page is only for customers.</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 32 }}>
      <h2>Order Products Directly</h2>
      <form onSubmit={handleGetRecommendations} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input name="application" placeholder="Application (e.g. DG-Solar Switch)" value={reqForm.application} onChange={handleReqFormChange} required style={{ width: 180 }} />
        <input name="power_load_kw" type="number" min={1} placeholder="Power Load (kW)" value={reqForm.power_load_kw} onChange={handleReqFormChange} required style={{ width: 120 }} />
        <input name="voltage_rating" type="number" min={1} placeholder="Voltage" value={reqForm.voltage_rating} onChange={handleReqFormChange} required style={{ width: 100 }} />
        <select name="phase_type" value={reqForm.phase_type} onChange={handleReqFormChange} required style={{ width: 120 }}>
          <option value="">Phase Type</option>
          <option value="Single">Single</option>
          <option value="3-phase">3-phase</option>
        </select>
        <select name="mount_type" value={reqForm.mount_type} onChange={handleReqFormChange} required style={{ width: 120 }}>
          <option value="">Mount Type</option>
          <option value="Indoor">Indoor</option>
          <option value="Outdoor">Outdoor</option>
        </select>
        <input name="compliance" placeholder="Compliance (comma separated)" value={reqForm.compliance} onChange={handleReqFormArrayChange} style={{ width: 180 }} />
        <input name="preferred_features" placeholder="Preferred Features (comma separated)" value={reqForm.preferred_features} onChange={handleReqFormArrayChange} style={{ width: 220 }} />
        <button type="submit" disabled={loading}>Get Recommendations</button>
      </form>
      {recommendations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4>Recommended Products</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Score</th>
                <th>Why Suitable</th>
                <th>Stock</th>
                <th>Lead Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map(p => (
                <tr key={p.product_id} style={{ background: selectedProduct && selectedProduct.product_id === p.product_id ? '#e0f7fa' : undefined }}>
                  <td>{p.name}</td>
                  <td>{p.match_score}</td>
                  <td><ul>{p.why_suitable.map((w, i) => <li key={i}>{w}</li>)}</ul></td>
                  <td>{p.stock_status}</td>
                  <td>{p.lead_time_days} days</td>
                  <td><button onClick={() => handleSelectProduct(p)} disabled={loading}>Select</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedProduct && (
        <div style={{ marginBottom: 16, border: '1px solid #ccc', borderRadius: 8, padding: 16 }}>
          <h4>Price Breakdown for: {selectedProduct.name}</h4>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
            <label>Quantity: <input type="number" min={1} value={orderQty} onChange={e => setOrderQty(Number(e.target.value))} style={{ width: 60 }} /></label>
            <label><input type="checkbox" checked={includeInstall} onChange={e => setIncludeInstall(e.target.checked)} /> Include Installation</label>
            <button onClick={handlePriceBreakdown} disabled={loading}>Update Price</button>
          </div>
          {priceBreakdown && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <tbody>
                <tr><td>Base Price</td><td>₹{priceBreakdown.product_base_price}</td></tr>
                <tr><td>Customization Fee</td><td>₹{priceBreakdown.customization_fee}</td></tr>
                <tr><td>Installation Charge</td><td>₹{priceBreakdown.installation_charge}</td></tr>
                <tr><td>Tax (18%)</td><td>₹{priceBreakdown.tax_amount}</td></tr>
                <tr><td>Delivery Fee</td><td>₹{priceBreakdown.delivery_fee}</td></tr>
                <tr><td><b>Total Price</b></td><td><b>₹{priceBreakdown.total_price}</b></td></tr>
                <tr><td>Profit Margin</td><td>{priceBreakdown.profit_margin_percent}%</td></tr>
                <tr><td>Net Profit</td><td>₹{priceBreakdown.net_profit_amount}</td></tr>
                <tr><td colSpan={2}><i>{priceBreakdown.note}</i></td></tr>
              </tbody>
            </table>
          )}
          <button onClick={handlePlaceOrder} disabled={loading || !priceBreakdown}>Place Order</button>
          {orderStatus && <div style={{ color: 'green', marginTop: 8 }}>{orderStatus}</div>}
          {orderError && <div style={{ color: 'red', marginTop: 8 }}>{orderError}</div>}
        </div>
      )}
      <hr style={{ margin: '32px 0' }} />
      {/* Old request UI below (unchanged) */}
      <h2>Submit New Product Request</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
        <select name="product_id" value={form.product_id} onChange={handleChange} required>
          <option value="">Select Product</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input name="quantity" type="number" min={1} placeholder="Quantity" value={form.quantity} onChange={handleChange} required style={{ width: 100 }} />
        <input name="expected_delivery" type="date" value={form.expected_delivery} onChange={handleChange} required />
        <input name="notes" placeholder="Notes (optional)" value={form.notes} onChange={handleChange} style={{ flex: 1 }} />
        <button type="submit" disabled={loading}>Submit</button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}
      <h3>Your Requests</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Expected Delivery</th>
            <th>Status</th>
            <th>Quoted Price</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.product_name}</td>
              <td>{r.quantity}</td>
              <td>{r.expected_delivery?.slice(0, 10)}</td>
              <td>{r.status}</td>
              <td>{r.quoted_price ? `₹${r.quoted_price}` : '-'}</td>
              <td>{r.customer_response || (r.status === 'quoted' ? (
                <>
                  <button onClick={() => handleRespond(r.id, 'accepted')} disabled={loading}>Accept</button>
                  <button onClick={() => handleRespond(r.id, 'declined')} disabled={loading}>Decline</button>
                </>
              ) : '-')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CustomerRequests; 