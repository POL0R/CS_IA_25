import React, { useState, useEffect } from 'react';
import { FaPlus, FaEye, FaEdit, FaTrash, FaFileInvoice, FaCheck, FaTimes, FaClock, FaTruck, FaBox } from 'react-icons/fa';
import './SupplierRequests.css';

export default function SupplierRequests({ user }) {
  const [requests, setRequests] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [masterProducts, setMasterProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [error, setError] = useState('');

  // Form states
  const [requestForm, setRequestForm] = useState({
    title: '',
    description: '',
    supplier_id: '',
    project_id: '',
    priority: 'medium',
    expected_delivery_date: '',
    delivery_address: '',
    notes: '',
    items: []
  });

  const [invoiceForm, setInvoiceForm] = useState({
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subtotal: 0,
    tax_amount: 0,
    shipping_amount: 0,
    discount_amount: 0,
    payment_terms: 'Net 30',
    notes: '',
    items: []
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsRes, suppliersRes, projectsRes, productsRes] = await Promise.all([
        fetch('http://localhost:5001/supplier-requests'),
        fetch('http://localhost:5001/suppliers'),
        fetch('http://localhost:5001/projects'),
        fetch('http://localhost:5001/finished_products')
      ]);

      const [requestsData, suppliersData, projectsData, productsData] = await Promise.all([
        requestsRes.json(),
        suppliersRes.json(),
        projectsRes.json(),
        productsRes.json()
      ]);

      setRequests(requestsData);
      setSuppliers(suppliersData);
      setProjects(projectsData);
      setMasterProducts(Array.isArray(productsData) ? productsData.map(fp => ({ id: fp.id, name: fp.model_name })) : []);
      setLoading(false);
    } catch (error) {
      setError('Failed to load data');
      setLoading(false);
    }
  };

  // Create new request
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5001/supplier-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestForm,
          requester_id: user.id
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setRequestForm({
          title: '',
          description: '',
          supplier_id: '',
          project_id: '',
          priority: 'medium',
          expected_delivery_date: '',
          delivery_address: '',
          notes: '',
          items: []
        });
        fetchData();
      } else {
        setError(data.error || 'Failed to create request');
      }
    } catch (error) {
      setError('Failed to create request');
    }
  };

  // Add item to request
  const addItemToRequest = () => {
    setRequestForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: 1, unit_price: 0, specifications: '', notes: '' }]
    }));
  };

  // Remove item from request
  const removeItemFromRequest = (index) => {
    setRequestForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Update request item
  const updateRequestItem = (index, field, value) => {
    setRequestForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // View request details
  const viewRequest = async (requestId) => {
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}`);
      const data = await response.json();
      setSelectedRequest(data);
      setShowRequestModal(true);
    } catch (error) {
      setError('Failed to load request details');
    }
  };

  // Update request status
  const updateRequestStatus = async (requestId, status) => {
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      const data = await response.json();
      if (data.success) {
        fetchData();
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest(prev => ({ ...prev, status }));
        }
      } else {
        setError(data.error || 'Failed to update status');
      }
    } catch (error) {
      setError('Failed to update status');
    }
  };

  // Create invoice
  const createInvoice = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${selectedRequest.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceForm)
      });

      const data = await response.json();
      if (data.success) {
        setShowInvoiceModal(false);
        setInvoiceForm({
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: 0,
          tax_amount: 0,
          shipping_amount: 0,
          discount_amount: 0,
          payment_terms: 'Net 30',
          notes: '',
          items: []
        });
        fetchData();
      } else {
        setError(data.error || 'Failed to create invoice');
      }
    } catch (error) {
      setError('Failed to create invoice');
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      draft: '#6b7280',
      sent: '#3b82f6',
      supplier_reviewing: '#f59e0b',
      supplier_quoted: '#8b5cf6',
      admin_reviewing: '#ec4899',
      approved: '#10b981',
      rejected: '#ef4444',
      in_production: '#06b6d4',
      ready_for_delivery: '#84cc16',
      delivered: '#059669',
      cancelled: '#dc2626'
    };
    return colors[status] || '#6b7280';
  };

  // Get status icon
  const getStatusIcon = (status) => {
    const icons = {
      draft: FaClock,
      sent: FaTruck,
      supplier_reviewing: FaEye,
      supplier_quoted: FaFileInvoice,
      admin_reviewing: FaEdit,
      approved: FaCheck,
      rejected: FaTimes,
      in_production: FaBox,
      ready_for_delivery: FaTruck,
      delivered: FaCheck,
      cancelled: FaTimes
    };
    return icons[status] || FaClock;
  };

  if (loading) {
    return (
      <div className="supplier-requests-loading">
        <div className="loading-spinner"></div>
        <h2>Loading supplier requests...</h2>
      </div>
    );
  }

  return (
    <div className="supplier-requests">
      <div className="page-header">
        <h1>Supplier Requests & Invoices</h1>
        <button 
          className="create-request-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <FaPlus />
          New Request
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="requests-grid">
        {requests.map(request => (
          <div key={request.id} className="request-card">
            <div className="request-header">
              <div className="request-info">
                <h3>{request.title}</h3>
                <p className="request-number">{request.request_number}</p>
              </div>
              <div className="request-status" style={{ color: getStatusColor(request.status) }}>
                {React.createElement(getStatusIcon(request.status))}
                <span>{request.status.replace('_', ' ').toUpperCase()}</span>
              </div>
            </div>

            <div className="request-details">
              <div className="detail-row">
                <span className="label">Supplier:</span>
                <span>{request.supplier_name}</span>
              </div>
              <div className="detail-row">
                <span className="label">Project:</span>
                <span>{request.project_name || 'General'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Priority:</span>
                <span className={`priority-${request.priority}`}>{request.priority}</span>
              </div>
              <div className="detail-row">
                <span className="label">Total Amount:</span>
                <span className="amount">${request.total_amount?.toLocaleString() || '0'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Expected Delivery:</span>
                <span>{request.expected_delivery_date ? new Date(request.expected_delivery_date).toLocaleDateString() : 'Not set'}</span>
              </div>
            </div>

            <div className="request-actions">
              <button 
                className="action-btn view"
                onClick={() => viewRequest(request.id)}
              >
                <FaEye />
                View Details
              </button>
              {request.status === 'supplier_quoted' && (
                <button 
                  className="action-btn approve"
                  onClick={() => updateRequestStatus(request.id, 'approved')}
                >
                  <FaCheck />
                  Approve
                </button>
              )}
              {request.status === 'draft' && (
                <button 
                  className="action-btn send"
                  onClick={() => updateRequestStatus(request.id, 'sent')}
                >
                  <FaTruck />
                  Send to Supplier
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Request Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Supplier Request</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateRequest} className="request-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Request Title *</label>
                  <input
                    type="text"
                    value={requestForm.title}
                    onChange={e => setRequestForm({...requestForm, title: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Supplier *</label>
                  <select
                    value={requestForm.supplier_id}
                    onChange={e => setRequestForm({...requestForm, supplier_id: e.target.value})}
                    required
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.company})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Project (Optional)</label>
                  <select
                    value={requestForm.project_id}
                    onChange={e => setRequestForm({...requestForm, project_id: e.target.value})}
                  >
                    <option value="">Select project...</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={requestForm.priority}
                    onChange={e => setRequestForm({...requestForm, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Expected Delivery Date</label>
                  <input
                    type="date"
                    value={requestForm.expected_delivery_date}
                    onChange={e => setRequestForm({...requestForm, expected_delivery_date: e.target.value})}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    value={requestForm.description}
                    onChange={e => setRequestForm({...requestForm, description: e.target.value})}
                    rows="3"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Delivery Address</label>
                  <textarea
                    value={requestForm.delivery_address}
                    onChange={e => setRequestForm({...requestForm, delivery_address: e.target.value})}
                    rows="2"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    value={requestForm.notes}
                    onChange={e => setRequestForm({...requestForm, notes: e.target.value})}
                    rows="2"
                  />
                </div>
              </div>

              <div className="items-section">
                <div className="items-header">
                  <h4>Request Items</h4>
                  <button 
                    type="button"
                    className="add-item-btn"
                    onClick={addItemToRequest}
                  >
                    <FaPlus />
                    Add Item
                  </button>
                </div>
                {requestForm.items.map((item, index) => (
                  <div key={index} className="item-row">
                    <select
                      value={item.product_id}
                      onChange={e => updateRequestItem(index, 'product_id', e.target.value)}
                      required
                    >
                      <option value="">Select product...</option>
                      {masterProducts.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Quantity"
                      value={item.quantity}
                      onChange={e => updateRequestItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                      min="1"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Unit Price"
                      value={item.unit_price}
                      onChange={e => updateRequestItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="0.01"
                    />
                    <button
                      type="button"
                      className="remove-item-btn"
                      onClick={() => removeItemFromRequest(index)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Create Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Details Modal */}
      {showRequestModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h3>Request Details - {selectedRequest.request_number}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowRequestModal(false)}
              >
                ×
              </button>
            </div>
            <div className="request-details-modal">
              <div className="request-info-section">
                <h4>Request Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Title:</label>
                    <span>{selectedRequest.title}</span>
                  </div>
                  <div className="info-item">
                    <label>Supplier:</label>
                    <span>{selectedRequest.supplier_name}</span>
                  </div>
                  <div className="info-item">
                    <label>Project:</label>
                    <span>{selectedRequest.project_name || 'General'}</span>
                  </div>
                  <div className="info-item">
                    <label>Priority:</label>
                    <span className={`priority-${selectedRequest.priority}`}>{selectedRequest.priority}</span>
                  </div>
                  <div className="info-item">
                    <label>Status:</label>
                    <span style={{ color: getStatusColor(selectedRequest.status) }}>
                      {selectedRequest.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Expected Delivery:</label>
                    <span>{selectedRequest.expected_delivery_date ? new Date(selectedRequest.expected_delivery_date).toLocaleDateString() : 'Not set'}</span>
                  </div>
                  <div className="info-item full-width">
                    <label>Description:</label>
                    <span>{selectedRequest.description || 'No description'}</span>
                  </div>
                  <div className="info-item full-width">
                    <label>Delivery Address:</label>
                    <span>{selectedRequest.delivery_address || 'Not specified'}</span>
                  </div>
                  <div className="info-item full-width">
                    <label>Notes:</label>
                    <span>{selectedRequest.notes || 'No notes'}</span>
                  </div>
                </div>
              </div>

              <div className="items-section">
                <h4>Request Items</h4>
                <div className="items-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Total</th>
                        <th>Specifications</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.items?.map((item, index) => (
                        <tr key={index}>
                          <td>{item.product_name}</td>
                          <td>{item.product_sku}</td>
                          <td>{item.quantity}</td>
                          <td>${item.unit_price?.toLocaleString()}</td>
                          <td>${item.total_price?.toLocaleString()}</td>
                          <td>{item.specifications || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="request-actions-section">
                <h4>Actions</h4>
                <div className="action-buttons">
                  {selectedRequest.status === 'supplier_quoted' && (
                    <>
                      <button 
                        className="action-btn approve"
                        onClick={() => updateRequestStatus(selectedRequest.id, 'approved')}
                      >
                        <FaCheck />
                        Approve Request
                      </button>
                      <button 
                        className="action-btn reject"
                        onClick={() => updateRequestStatus(selectedRequest.id, 'rejected')}
                      >
                        <FaTimes />
                        Reject Request
                      </button>
                    </>
                  )}
                  {selectedRequest.status === 'approved' && (
                    <button 
                      className="action-btn invoice"
                      onClick={() => setShowInvoiceModal(true)}
                    >
                      <FaFileInvoice />
                      Create Invoice
                    </button>
                  )}
                  {selectedRequest.status === 'draft' && (
                    <button 
                      className="action-btn send"
                      onClick={() => updateRequestStatus(selectedRequest.id, 'sent')}
                    >
                      <FaTruck />
                      Send to Supplier
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showInvoiceModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Invoice for {selectedRequest.request_number}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowInvoiceModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={createInvoice} className="invoice-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Issue Date *</label>
                  <input
                    type="date"
                    value={invoiceForm.issue_date}
                    onChange={e => setInvoiceForm({...invoiceForm, issue_date: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input
                    type="date"
                    value={invoiceForm.due_date}
                    onChange={e => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Subtotal</label>
                  <input
                    type="number"
                    value={invoiceForm.subtotal}
                    onChange={e => setInvoiceForm({...invoiceForm, subtotal: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Tax Amount</label>
                  <input
                    type="number"
                    value={invoiceForm.tax_amount}
                    onChange={e => setInvoiceForm({...invoiceForm, tax_amount: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Shipping Amount</label>
                  <input
                    type="number"
                    value={invoiceForm.shipping_amount}
                    onChange={e => setInvoiceForm({...invoiceForm, shipping_amount: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Discount Amount</label>
                  <input
                    type="number"
                    value={invoiceForm.discount_amount}
                    onChange={e => setInvoiceForm({...invoiceForm, discount_amount: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="form-group">
                  <label>Payment Terms</label>
                  <input
                    type="text"
                    value={invoiceForm.payment_terms}
                    onChange={e => setInvoiceForm({...invoiceForm, payment_terms: e.target.value})}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    value={invoiceForm.notes}
                    onChange={e => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                    rows="3"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowInvoiceModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 