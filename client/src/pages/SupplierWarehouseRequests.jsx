import React, { useState, useEffect } from 'react';
import { FiEye, FiMapPin, FiCalendar, FiDollarSign, FiPackage, FiUsers, FiCheck, FiX, FiPlus } from 'react-icons/fi';
import './SupplierWarehouseRequests.css';

const SupplierWarehouseRequests = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    estimated_delivery_date: '',
    delivery_terms: '',
    expires_at: '',
    notes: '',
    terms_conditions: '',
    delivery_cost: 0,
    tax_amount: 0,
    items: []
  });

  const [newQuoteItem, setNewQuoteItem] = useState({
    product_id: '',
    quantity: '',
    unit_price: '',
    available_stock: '',
    lead_time_days: '',
    specifications: '',
    notes: ''
  });

  useEffect(() => {
    if (!user || !user.id) {
      setLoading(false);
      console.error('Supplier user ID is missing. Please log in again.');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsRes, productsRes] = await Promise.all([
        fetch(`http://localhost:5001/warehouse-requests/supplier/${user.id}`),
        fetch('http://localhost:5001/finished_products')
      ]);

      const [requestsData, productsData] = await Promise.all([
        requestsRes.json(),
        productsRes.json()
      ]);

      setRequests(requestsData);
      setProducts(Array.isArray(productsData) ? productsData.map(fp => ({ id: fp.id, name: fp.model_name })) : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addQuoteItem = () => {
    if (newQuoteItem.product_id && newQuoteItem.quantity && newQuoteItem.unit_price) {
      setQuoteForm(prev => ({
        ...prev,
        items: [...prev.items, { ...newQuoteItem }]
      }));
      setNewQuoteItem({
        product_id: '',
        quantity: '',
        unit_price: '',
        available_stock: '',
        lead_time_days: '',
        specifications: '',
        notes: ''
      });
    }
  };

  const removeQuoteItem = (index) => {
    setQuoteForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const submitQuote = async () => {
    try {
      const response = await fetch('http://localhost:5001/supplier-quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...quoteForm,
          request_id: selectedRequest.id,
          supplier_id: user.id
        }),
      });

      if (response.ok) {
        setShowQuoteModal(false);
        setQuoteForm({
          estimated_delivery_date: '',
          delivery_terms: '',
          expires_at: '',
          notes: '',
          terms_conditions: '',
          delivery_cost: 0,
          tax_amount: 0,
          items: []
        });
        fetchData();
      }
    } catch (error) {
      console.error('Error submitting quote:', error);
    }
  };

  const viewRequest = async (requestId) => {
    try {
      const response = await fetch(`http://localhost:5001/warehouse-requests/${requestId}`);
      const requestData = await response.json();
      setSelectedRequest(requestData);
      setShowQuoteModal(true);
    } catch (error) {
      console.error('Error fetching request details:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-500',
      sent_to_suppliers: 'bg-blue-500',
      suppliers_reviewing: 'bg-yellow-500',
      supplier_quoted: 'bg-green-500',
      admin_reviewing: 'bg-purple-500',
      supplier_selected: 'bg-indigo-500',
      order_placed: 'bg-orange-500',
      delivered: 'bg-green-600',
      cancelled: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="supplier-warehouse-requests-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="supplier-warehouse-requests-container">
      <div className="header">
        <h1>Warehouse-Based Requests</h1>
        <p>View and respond to requests from nearby warehouses</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <FiPackage className="stat-icon" />
          <div>
            <h3>{requests.length}</h3>
            <p>Available Requests</p>
          </div>
        </div>
        <div className="stat-card">
          <FiMapPin className="stat-icon" />
          <div>
            <h3>{requests.filter(r => r.distance_km <= 50).length}</h3>
            <p>Within 50km</p>
          </div>
        </div>
        <div className="stat-card">
          <FiUsers className="stat-icon" />
          <div>
            <h3>{requests.filter(r => r.has_quoted).length}</h3>
            <p>Quotes Submitted</p>
          </div>
        </div>
        <div className="stat-card">
          <FiDollarSign className="stat-icon" />
          <div>
            <h3>${requests.reduce((sum, r) => sum + (r.total_predicted_amount || 0), 0).toFixed(2)}</h3>
            <p>Total Value</p>
          </div>
        </div>
      </div>

      <div className="requests-grid">
        {requests.map(request => (
          <div key={request.id} className="request-card">
            <div className="request-header">
              <h3>{request.title}</h3>
              <div className="request-meta">
                <span className={`status-badge ${getStatusColor(request.status)}`}>
                  {request.status.replace('_', ' ')}
                </span>
                <span className={`priority-badge ${getPriorityColor(request.priority)}`}>
                  {request.priority}
                </span>
              </div>
            </div>
            
            <div className="request-details">
              <p><strong>Request #:</strong> {request.request_number}</p>
              <p><strong>Project:</strong> {request.project_name}</p>
              <p><strong>Warehouse:</strong> {request.warehouse_name}</p>
              <p><strong>Distance:</strong> {request.distance_km}km</p>
              <p><strong>Delivery Date:</strong> {new Date(request.required_delivery_date).toLocaleDateString()}</p>
              <p><strong>Predicted Amount:</strong> ${request.total_predicted_amount?.toFixed(2)}</p>
            </div>

            <div className="request-actions">
              <button onClick={() => viewRequest(request.id)} className="action-btn view">
                <FiEye /> View Details
              </button>
              {!request.has_quoted && (
                <button onClick={() => viewRequest(request.id)} className="action-btn quote">
                  <FiPlus /> Submit Quote
                </button>
              )}
              {request.has_quoted && (
                <span className="quoted-badge">
                  <FiCheck /> Quote Submitted
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quote Modal */}
      {showQuoteModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>Submit Quote for {selectedRequest.title}</h2>
              <button onClick={() => setShowQuoteModal(false)} className="close-btn">
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="request-summary">
                <h4>Request Summary</h4>
                <p><strong>Project:</strong> {selectedRequest.project_name}</p>
                <p><strong>Warehouse:</strong> {selectedRequest.warehouse_name}</p>
                <p><strong>Required Delivery:</strong> {new Date(selectedRequest.required_delivery_date).toLocaleDateString()}</p>
                <p><strong>Items:</strong> {selectedRequest.items?.length || 0}</p>
              </div>

              <div className="quote-form">
                <h4>Quote Details</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Estimated Delivery Date *</label>
                    <input
                      type="datetime-local"
                      value={quoteForm.estimated_delivery_date}
                      onChange={(e) => setQuoteForm({...quoteForm, estimated_delivery_date: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Quote Expires At *</label>
                    <input
                      type="datetime-local"
                      value={quoteForm.expires_at}
                      onChange={(e) => setQuoteForm({...quoteForm, expires_at: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Delivery Terms</label>
                    <input
                      type="text"
                      value={quoteForm.delivery_terms}
                      onChange={(e) => setQuoteForm({...quoteForm, delivery_terms: e.target.value})}
                      placeholder="e.g., FOB Destination, Net 30"
                    />
                  </div>

                  <div className="form-group">
                    <label>Delivery Cost</label>
                    <input
                      type="number"
                      value={quoteForm.delivery_cost}
                      onChange={(e) => setQuoteForm({...quoteForm, delivery_cost: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                    />
                  </div>

                  <div className="form-group">
                    <label>Tax Amount</label>
                    <input
                      type="number"
                      value={quoteForm.tax_amount}
                      onChange={(e) => setQuoteForm({...quoteForm, tax_amount: parseFloat(e.target.value) || 0})}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={quoteForm.notes}
                    onChange={(e) => setQuoteForm({...quoteForm, notes: e.target.value})}
                    placeholder="Additional notes for the customer"
                  />
                </div>

                <div className="form-group">
                  <label>Terms & Conditions</label>
                  <textarea
                    value={quoteForm.terms_conditions}
                    onChange={(e) => setQuoteForm({...quoteForm, terms_conditions: e.target.value})}
                    placeholder="Terms and conditions for this quote"
                  />
                </div>

                <div className="items-section">
                  <h4>Quote Items</h4>
                  <div className="add-item-form">
                    <div className="item-inputs">
                      <select
                        value={newQuoteItem.product_id}
                        onChange={(e) => setNewQuoteItem({...newQuoteItem, product_id: e.target.value})}
                      >
                        <option value="">Select Product</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={newQuoteItem.quantity}
                        onChange={(e) => setNewQuoteItem({...newQuoteItem, quantity: e.target.value})}
                      />
                      <input
                        type="number"
                        placeholder="Unit Price"
                        value={newQuoteItem.unit_price}
                        onChange={(e) => setNewQuoteItem({...newQuoteItem, unit_price: e.target.value})}
                      />
                      <input
                        type="number"
                        placeholder="Available Stock"
                        value={newQuoteItem.available_stock}
                        onChange={(e) => setNewQuoteItem({...newQuoteItem, available_stock: e.target.value})}
                      />
                      <input
                        type="number"
                        placeholder="Lead Time (days)"
                        value={newQuoteItem.lead_time_days}
                        onChange={(e) => setNewQuoteItem({...newQuoteItem, lead_time_days: e.target.value})}
                      />
                      <button onClick={addQuoteItem} className="add-item-btn">
                        <FiPlus /> Add Item
                      </button>
                    </div>
                  </div>

                  {quoteForm.items.length > 0 && (
                    <div className="items-list">
                      {quoteForm.items.map((item, index) => {
                        const product = products.find(p => p.id == item.product_id);
                        return (
                          <div key={index} className="item-row">
                            <span>{product?.name || 'Unknown Product'}</span>
                            <span>Qty: {item.quantity}</span>
                            <span>${item.unit_price}</span>
                            <span>Stock: {item.available_stock}</span>
                            <span>Lead: {item.lead_time_days} days</span>
                            <button onClick={() => removeQuoteItem(index)} className="remove-item-btn">
                              <FiX />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowQuoteModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={submitQuote} className="submit-btn">
                Submit Quote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierWarehouseRequests; 