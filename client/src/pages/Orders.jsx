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
    fetch("http://localhost:5001/orders")
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

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
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
          <h1 className="page-title">Customer Orders</h1>
          <p className="page-subtitle">Manage customer orders, track order status, and process stock movements</p>
        </div>
        <div className="header-actions">
          <button 
            className="action-btn create-order"
            onClick={() => setShowCreateOrder(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Create Order
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
            placeholder="Search orders by number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-controls">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="orders-table-container">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Order Date</th>
              <th>Delivery Date</th>
              <th>Total Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id}>
                <td className="order-number">{order.order_number}</td>
                <td>
                  <div className="customer-info">
                    <div className="customer-name">{order.customer_name}</div>
                    <div className="customer-email">{order.customer_email}</div>
                  </div>
                </td>
                <td>{getStatusBadge(order.status)}</td>
                <td>{formatDate(order.order_date)}</td>
                <td>{order.delivery_date ? formatDate(order.delivery_date) : '-'}</td>
                <td className="amount">${order.total_amount.toFixed(2)}</td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn-edit"
                      onClick={() => handleEditOrder(order)}
                      title="Edit Order"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    {order.status === 'confirmed' && (
                      <button 
                        className="btn-process"
                        onClick={() => handleProcessOrder(order.id)}
                        title="Process Order"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              <strong>Total Amount: ${calculateTotal().toFixed(2)}</strong>
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
    delivery_date: order.delivery_date ? order.delivery_date.slice(0, 16) : '',
    notes: order.notes || '',
    items: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch order items
    fetch(`http://localhost:5001/orders/${order.id}/items`)
      .then(res => res.json())
      .then(data => {
        setFormData(prev => ({
          ...prev,
          items: data.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.notes || ''
          }))
        }));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
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
      <div className="modal-content order-form">
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
              <strong>Total Amount: ${calculateTotal().toFixed(2)}</strong>
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