import React, { useState, useEffect } from "react";
import "./Orders.css";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
    fetchFinishedProducts();
  }, []);

  const fetchOrders = () => {
    fetch("http://localhost:5001/customer_requests")
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(() => setOrders([]));
  };

  const fetchCustomers = () => {
    fetch("http://localhost:5001/customers")
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(() => setCustomers([]));
  };

  const fetchFinishedProducts = () => {
    fetch("http://localhost:5001/finished_products")
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data.map(fp => ({ id: fp.id, name: fp.model_name })) : []))
      .catch(() => setProducts([]));
  };

  const handleCreateOrder = (orderData) => {
    fetch("http://localhost:5001/orders", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchOrders();
        setShowCreateOrder(false);
      } else {
        alert('Error: ' + (data.error || 'Failed to create order'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleUpdateOrder = (orderId, orderData) => {
    fetch(`http://localhost:5001/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchOrders();
        setShowEditOrder(false);
        setSelectedOrder(null);
      } else {
        alert('Error: ' + (data.error || 'Failed to update order'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleProcessOrder = (orderId) => {
    fetch(`http://localhost:5001/orders/${orderId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchOrders();
        fetchProducts(); // Refresh products to show updated stock
        alert('Order processed successfully!');
      } else {
        alert('Error: ' + (data.error || 'Failed to process order'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleEditOrder = (order) => {
    setSelectedOrder(order);
    setShowEditOrder(true);
  };

  const handleOrderStatusUpdate = (requestId, action) => {
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
        fetchOrders();
      })
      .catch(error => {
        console.error(`Error ${action}ing request:`, error);
        alert(`Failed to ${action} customer request: ${error.message}`);
      });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (order.product_name && order.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (order.id && order.id.toString().includes(searchTerm));
    const matchesStatus = filterStatus === "all" || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      'pending': 'orange',
      'confirmed': 'blue',
      'processing': 'purple',
      'shipped': 'cyan',
      'delivered': 'green',
      'cancelled': 'red'
    };
    return (
      <span className={`status-badge ${statusColors[status] || 'gray'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="orders-container">
      {/* Header */}
      <div className="orders-header">
        <div className="header-left">
          <h1 className="page-title">Customer Requests</h1>
          <p className="page-subtitle">Manage customer requests, track request status, and provide quotes</p>
        </div>
        <div className="header-actions">
          <button 
            className="action-btn create-order"
            onClick={() => setShowCreateOrder(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            View All Requests
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="Search requests by customer, product, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-controls">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="manager_review">Manager Review</option>
            <option value="quoted">Quoted</option>
            <option value="customer_accepted">Customer Accepted</option>
            <option value="customer_declined">Customer Declined</option>
            <option value="in_transit">In Transit</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="orders-cards-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {filteredOrders.length === 0 ? (
          <div style={{ color: '#888', marginBottom: 16 }}>No orders found.</div>
        ) : filteredOrders.map(order => (
          <div key={order.id} style={{
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
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Request #{order.id}</div>
            <div style={{ marginBottom: 6 }}><b>Customer:</b> {order.customer_name || order.customer_id}</div>
            <div style={{ marginBottom: 6 }}><b>Product:</b> {order.product_name || order.product_id}</div>
            <div style={{ marginBottom: 6 }}><b>Quantity:</b> {order.quantity}</div>
            <div style={{ marginBottom: 6 }}><b>Status:</b> <span style={{ textTransform: 'capitalize', color: order.status === 'submitted' ? '#fbbf24' : order.status === 'manager_review' ? '#3b82f6' : order.status === 'quoted' ? '#10b981' : '#ef4444' }}>{order.status}</span></div>
            <div style={{ marginBottom: 6 }}><b>Created:</b> {order.created_at ? formatDate(order.created_at) : ''}</div>
            <div style={{ marginBottom: 6 }}><b>Expected Delivery:</b> {order.expected_delivery ? formatDate(order.expected_delivery) : '-'}</div>
            <div style={{ marginBottom: 6 }}><b>Delivery Address:</b> {order.delivery_address || '-'}</div>
            <div style={{ marginBottom: 6 }}><b>Quoted Price:</b> {order.quoted_price ? `₹${order.quoted_price}` : 'Not quoted yet'}</div>
            <div style={{ marginBottom: 6 }}><b>Notes:</b> {order.notes || '-'}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button onClick={() => handleOrderStatusUpdate(order.id, 'approve')} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>Approve</button>
              <button onClick={() => handleOrderStatusUpdate(order.id, 'reject')} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>Reject</button>
              <button onClick={() => handleOrderStatusUpdate(order.id, 'quote')} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>Quote</button>
            </div>
                  </div>
            ))}
      </div>

      {/* Create Order Modal */}
      {showCreateOrder && (
        <CreateOrderForm
          customers={customers}
          products={products}
          onSubmit={handleCreateOrder}
          onCancel={() => setShowCreateOrder(false)}
        />
      )}

      {/* Edit Order Modal */}
      {showEditOrder && selectedOrder && (
        <EditOrderForm
          order={selectedOrder}
          customers={customers}
          products={products}
          onSubmit={handleUpdateOrder}
          onCancel={() => {
            setShowEditOrder(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}

function CreateOrderForm({ customers, products, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    customer_id: '',
    delivery_date: '',
    notes: '',
    items: [{ product_id: '', quantity: 1, unit_price: 0, notes: '' }]
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      alert('Please select a customer');
      return;
    }
    if (formData.items.length === 0 || !formData.items[0].product_id) {
      alert('Please add at least one product');
      return;
    }
    onSubmit(formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Auto-calculate unit price if product is selected
    if (field === 'product_id') {
      const product = products.find(p => p.id == value);
      if (product) {
        newItems[index].unit_price = product.cost || 0;
      }
    }
    
    setFormData({
      ...formData,
      items: newItems
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0, notes: '' }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        items: newItems
      });
    }
  };

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      return total + (item.quantity * item.unit_price);
    }, 0);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content order-form">
        <div className="modal-header">
          <h2>Create New Order</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Order Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Customer *</label>
                <select name="customer_id" value={formData.customer_id} onChange={handleChange} required>
                  <option value="">Select a customer</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.company || customer.email}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Delivery Date</label>
                <input
                  type="datetime-local"
                  name="delivery_date"
                  value={formData.delivery_date}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Additional notes for this order..."
              />
            </div>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Order Items</h3>
              <button type="button" className="btn-add-item" onClick={addItem}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add Item
              </button>
            </div>
            
            {formData.items.map((item, index) => (
              <div key={index} className="order-item">
                <div className="item-grid">
                  <div className="form-group">
                    <label>Product *</label>
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                      required
                    >
                      <option value="">Select a product</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku}) - Available: {product.quantity}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                      required
                      min="1"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Unit Price *</label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Total Price</label>
                    <input
                      type="number"
                      value={(item.quantity * item.unit_price).toFixed(2)}
                      disabled
                      className="disabled-input"
                      style={{ background: '#f8f9fa' }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Notes</label>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                      placeholder="Item notes..."
                    />
                  </div>
                  
                  <button
                    type="button"
                    className="btn-remove-item"
                    onClick={() => removeItem(index)}
                    disabled={formData.items.length === 1}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            
            <div className="order-total">
              <strong>Total Amount: ₹{calculateTotal().toFixed(2)}</strong>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Create Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOrderForm({ order, customers, products, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    status: order.status,
    proposed_deadline: order.proposed_deadline ? order.proposed_deadline.slice(0, 16) : '',
    delivery_address: order.delivery_address || '',
    notes: order.notes || '',
    items: []
  });
  const [loading, setLoading] = useState(true);
  const [priceBreakdown, setPriceBreakdown] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(true);

  useEffect(() => {
    // Fetch order items and price breakdown
    Promise.all([
      fetch(`http://localhost:5001/orders/${order.id}/items`),
      fetch(`http://localhost:5001/orders/${order.id}/price-breakdown`)
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([itemsData, breakdownData]) => {
      setFormData(prev => ({
        ...prev,
        items: itemsData.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || ''
        }))
      }));
      setPriceBreakdown(breakdownData);
      setLoading(false);
      setBreakdownLoading(false);
    })
    .catch(() => {
      setLoading(false);
      setBreakdownLoading(false);
    });
  }, [order.id]);



  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.items.length === 0 || !formData.items[0].product_id) {
      alert('Please add at least one product');
      return;
    }
    onSubmit(order.id, formData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Auto-calculate unit price if product is selected
    if (field === 'product_id') {
      const product = products.find(p => p.id == value);
      if (product) {
        newItems[index].unit_price = product.cost || 0;
      }
    }
    
    setFormData({
      ...formData,
      items: newItems
    });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', quantity: 1, unit_price: 0, notes: '' }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        items: newItems
      });
    }
  };

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      return total + (item.quantity * item.unit_price);
    }, 0);
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading">Loading order details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content order-form" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2>Edit Order: {order.order_number}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Order Details</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Customer</label>
                <input
                  type="text"
                  value={order.customer_name}
                  disabled
                  className="disabled-input"
                />
              </div>
              
              <div className="form-group">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleChange}>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Proposed Deadline</label>
                <input
                  type="datetime-local"
                  name="proposed_deadline"
                  value={formData.proposed_deadline}
                  onChange={handleChange}
                />
              </div>
              
              <div className="form-group">
                <label>Delivery Address</label>
                <textarea
                  name="delivery_address"
                  value={formData.delivery_address}
                  onChange={handleChange}
                  placeholder="Enter delivery address..."
                  rows="2"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Additional notes for this order..."
              />
            </div>
          </div>

          {/* Price Breakdown Section */}
          <div className="form-section">
            <div className="section-header">
              <h3>Price Breakdown</h3>
              {breakdownLoading && (
                <div style={{ fontSize: '14px', color: '#6c757d' }}>
                  Loading price breakdown...
                </div>
              )}
            </div>
            
            {priceBreakdown && (
              <div className="price-breakdown-section" style={{
                background: '#f8f9fa',
                borderRadius: '8px',
                padding: '20px',
                marginTop: '16px'
              }}>
                <h4 style={{ marginBottom: '16px', color: '#1d3557' }}>Detailed Price Breakdown</h4>
                
                <div className="breakdown-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '20px'
                }}>
                  <div className="breakdown-item">
                    <span className="label">Product Base Price:</span>
                    <span className="value">₹{priceBreakdown.product_base_price?.toLocaleString() || '0'}</span>
                  </div>
                  
                  <div className="breakdown-item">
                    <span className="label">Labor Cost:</span>
                    <span className="value">₹{priceBreakdown.labor_cost?.toLocaleString() || '0'}</span>
                  </div>
                  
                  <div className="breakdown-item">
                    <span className="label">Customization Fee:</span>
                    <span className="value">₹{priceBreakdown.customization_fee?.toLocaleString() || '0'}</span>
                  </div>
                  
                  <div className="breakdown-item">
                    <span className="label">Installation Charge:</span>
                    <span className="value">₹{priceBreakdown.installation_charge?.toLocaleString() || '0'}</span>
                  </div>
                  
                  <div className="breakdown-item">
                    <span className="label">Delivery Fee:</span>
                    <span className="value">₹{priceBreakdown.delivery_fee?.toLocaleString() || '0'}</span>
                  </div>
                  
                  <div className="breakdown-item">
                    <span className="label">Tax Amount (18%):</span>
                    <span className="value">₹{priceBreakdown.tax_amount?.toLocaleString() || '0'}</span>
                  </div>
                  
                  {priceBreakdown.total_quantity && (
                    <div className="breakdown-item">
                      <span className="label">Total Quantity:</span>
                      <span className="value">{priceBreakdown.total_quantity}</span>
                    </div>
                  )}
                  
                  {priceBreakdown.procurement_cost !== undefined && (
                    <div className="breakdown-item">
                      <span className="label">Procurement Cost:</span>
                      <span className="value">₹{priceBreakdown.procurement_cost?.toLocaleString() || '0'}</span>
                    </div>
                  )}
                </div>
                
                <div className="total-section" style={{
                  borderTop: '2px solid #dee2e6',
                  paddingTop: '16px',
                  marginTop: '16px'
                }}>
                  <div className="total-row" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#1d3557'
                  }}>
                    <span>Total Price:</span>
                    <span>₹{priceBreakdown.total_price?.toLocaleString() || '0'}</span>
                  </div>
                  
                  {priceBreakdown.profit_margin_percent !== undefined && (
                    <div className="profit-info" style={{
                      marginTop: '8px',
                      fontSize: '14px',
                      color: '#6c757d'
                    }}>
                      <span>Profit Margin: {priceBreakdown.profit_margin_percent}%</span>
                      <span style={{ marginLeft: '16px' }}>
                        Net Profit: ₹{priceBreakdown.net_profit_amount?.toLocaleString() || '0'}
                      </span>
                    </div>
                  )}
                  
                  {/* Order Summary */}
                  <div className="order-summary" style={{
                    marginTop: '16px',
                    padding: '12px',
                    background: '#e9ecef',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
                      Order Summary
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <span>Order Number: {priceBreakdown.order_number}</span>
                      <span>Status: {priceBreakdown.order_status}</span>
                      <span>Total Quantity: {priceBreakdown.total_quantity}</span>
                      <span>Estimated Hours: {priceBreakdown.estimated_hours}</span>
                    </div>
                  </div>
                </div>
                
                {/* Materials Breakdown */}
                {priceBreakdown.materials_breakdown && priceBreakdown.materials_breakdown.length > 0 && (
                  <div className="materials-breakdown" style={{ marginTop: '20px' }}>
                    <h5 style={{ marginBottom: '12px', color: '#1d3557' }}>Materials Breakdown</h5>
                    <div className="materials-list" style={{
                      background: 'white',
                      borderRadius: '4px',
                      padding: '12px'
                    }}>
                      {priceBreakdown.materials_breakdown.map((material, index) => (
                        <div key={index} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '4px 0',
                          borderBottom: index < priceBreakdown.materials_breakdown.length - 1 ? '1px solid #eee' : 'none'
                        }}>
                          <span>{material.name} (Qty: {material.quantity})</span>
                          <span>₹{material.total_cost?.toLocaleString() || '0'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Skills Information */}
                {priceBreakdown.skills && priceBreakdown.skills.length > 0 && (
                  <div className="skills-info" style={{ marginTop: '16px' }}>
                    <h5 style={{ marginBottom: '8px', color: '#1d3557' }}>Required Skills</h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {priceBreakdown.skills.map((skill, index) => (
                        <span key={index} style={{
                          background: '#e9ecef',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#495057'
                        }}>
                          {skill}
                        </span>
                      ))}
                    </div>
                    {priceBreakdown.estimated_hours && (
                      <div style={{ marginTop: '8px', fontSize: '14px', color: '#6c757d' }}>
                        Estimated Hours: {priceBreakdown.estimated_hours}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="section-header">
              <h3>Order Items</h3>
              <button type="button" className="btn-add-item" onClick={addItem}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add Item
              </button>
            </div>
            
            {formData.items.map((item, index) => (
              <div key={index} className="order-item">
                <div className="item-grid">
                  <div className="form-group">
                    <label>Product *</label>
                    <select
                      value={item.product_id}
                      onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                      required
                    >
                      <option value="">Select a product</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku}) - Available: {product.quantity}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                      required
                      min="1"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Unit Price *</label>
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Total Price</label>
                    <input
                      type="number"
                      value={(item.quantity * item.unit_price).toFixed(2)}
                      disabled
                      className="disabled-input"
                      style={{ background: '#f8f9fa' }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Notes</label>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                      placeholder="Item notes..."
                    />
                  </div>
                  
                  <button
                    type="button"
                    className="btn-remove-item"
                    onClick={() => removeItem(index)}
                    disabled={formData.items.length === 1}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            
            <div className="order-total">
              <strong>Total Amount: ₹{calculateTotal().toFixed(2)}</strong>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Update Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 