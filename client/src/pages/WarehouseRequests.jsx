import React, { useState, useEffect } from 'react';
import { FiPlus, FiEye, FiEdit, FiTrash2, FiMapPin, FiCalendar, FiDollarSign, FiPackage, FiUsers, FiCheck, FiX } from 'react-icons/fi';
import './WarehouseRequests.css';

const WarehouseRequests = ({ user }) => {
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showQuotesModal, setShowQuotesModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [nearbySuppliers, setNearbySuppliers] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    warehouse_id: '',
    priority: 'medium',
    required_delivery_date: '',
    notes: '',
    items: []
  });

  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity_required: '',
    predicted_unit_price: '',
    specifications: '',
    priority: 'normal',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsRes, projectsRes, warehousesRes, productsRes, suppliersRes] = await Promise.all([
        fetch('http://localhost:5001/warehouse-requests'),
        fetch('http://localhost:5001/projects'),
        fetch('http://localhost:5001/warehouses'),
        fetch('http://localhost:5001/finished_products'),
        fetch('http://localhost:5001/suppliers')
      ]);

      const [requestsData, projectsData, warehousesData, productsData, suppliersData] = await Promise.all([
        requestsRes.json(),
        projectsRes.json(),
        warehousesRes.json(),
        productsRes.json(),
        suppliersRes.json()
      ]);

      setRequests(requestsData);
      setProjects(projectsData);
      setWarehouses(warehousesData);
      setProducts(Array.isArray(productsData) ? productsData.map(fp => ({ id: fp.id, name: fp.model_name })) : []);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = async (warehouseId) => {
    setSelectedWarehouse(warehouseId);
    if (warehouseId) {
      try {
        const response = await fetch(`http://localhost:5001/suppliers/nearby/${warehouseId}`);
        const nearbyData = await response.json();
        setNearbySuppliers(nearbyData);
      } catch (error) {
        console.error('Error fetching nearby suppliers:', error);
      }
    }
  };

  const addItem = () => {
    if (newItem.product_id && newItem.quantity_required) {
      setFormData(prev => ({
        ...prev,
        items: [...prev.items, { ...newItem }]
      }));
      setNewItem({
        product_id: '',
        quantity_required: '',
        predicted_unit_price: '',
        specifications: '',
        priority: 'normal',
        notes: ''
      });
    }
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const createRequest = async () => {
    try {
      const response = await fetch('http://localhost:5001/warehouse-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          requester_id: user.id
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          project_id: '',
          warehouse_id: '',
          priority: 'medium',
          required_delivery_date: '',
          notes: '',
          items: []
        });
        fetchData();
      }
    } catch (error) {
      console.error('Error creating request:', error);
    }
  };

  const viewRequest = async (requestId) => {
    try {
      const response = await fetch(`http://localhost:5001/warehouse-requests/${requestId}`);
      const requestData = await response.json();
      setSelectedRequest(requestData);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error fetching request details:', error);
    }
  };

  const viewQuotes = async (requestId) => {
    try {
      const response = await fetch(`http://localhost:5001/warehouse-requests/${requestId}/quotes`);
      const quotesData = await response.json();
      setQuotes(quotesData);
      setSelectedRequest(requests.find(r => r.id === requestId));
      setShowQuotesModal(true);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      await fetch(`http://localhost:5001/warehouse-requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
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
      <div className="warehouse-requests-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="warehouse-requests-container">
      <div className="header">
        <h1>Warehouse-Based Supplier Requests</h1>
        <p>Create and manage supplier requests based on warehouse proximity</p>
        <button 
          className="create-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <FiPlus /> Create New Request
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <FiPackage className="stat-icon" />
          <div>
            <h3>{requests.length}</h3>
            <p>Total Requests</p>
          </div>
        </div>
        <div className="stat-card">
          <FiUsers className="stat-icon" />
          <div>
            <h3>{suppliers.length}</h3>
            <p>Available Suppliers</p>
          </div>
        </div>
        <div className="stat-card">
          <FiMapPin className="stat-icon" />
          <div>
            <h3>{warehouses.length}</h3>
            <p>Warehouses</p>
          </div>
        </div>
        <div className="stat-card">
          <FiDollarSign className="stat-icon" />
          <div>
            <h3>{requests.filter(r => r.status === 'supplier_quoted').length}</h3>
            <p>Quotes Received</p>
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
              <p><strong>Delivery Date:</strong> {new Date(request.required_delivery_date).toLocaleDateString()}</p>
              <p><strong>Predicted Amount:</strong> ${request.total_predicted_amount?.toFixed(2)}</p>
              <p><strong>Items:</strong> {request.items_count}</p>
              <p><strong>Quotes:</strong> {request.quotes_count}</p>
            </div>

            <div className="request-actions">
              <button onClick={() => viewRequest(request.id)} className="action-btn view">
                <FiEye /> View
              </button>
              {request.quotes_count > 0 && (
                <button onClick={() => viewQuotes(request.id)} className="action-btn quotes">
                  <FiUsers /> Quotes ({request.quotes_count})
                </button>
              )}
              {request.status === 'draft' && (
                <button 
                  onClick={() => updateRequestStatus(request.id, 'sent_to_suppliers')}
                  className="action-btn send"
                >
                  Send to Suppliers
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create Request Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create Warehouse Request</h2>
              <button onClick={() => setShowCreateModal(false)} className="close-btn">
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Request title"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Request description"
                  />
                </div>

                <div className="form-group">
                  <label>Project *</label>
                  <select
                    value={formData.project_id}
                    onChange={(e) => setFormData({...formData, project_id: e.target.value})}
                  >
                    <option value="">Select Project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Warehouse *</label>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => {
                      setFormData({...formData, warehouse_id: e.target.value});
                      handleWarehouseChange(e.target.value);
                    }}
                  >
                    <option value="">Select Warehouse</option>
                    {/* Only show user's saved warehouses if available, else all */}
                    {(user?.role === 'admin' || user?.role === 'project_manager' || !user?.saved_warehouses)
                      ? warehouses.map(warehouse => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} - {warehouse.location}
                          </option>
                        ))
                      : warehouses.filter(warehouse => (user.saved_warehouses || []).includes(warehouse.id)).map(warehouse => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} - {warehouse.location}
                          </option>
                        ))
                    }
                  </select>
                  {/* TODO: If user.saved_warehouses is not implemented, add it to user model and API */}
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Required Delivery Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.required_delivery_date}
                    onChange={(e) => setFormData({...formData, required_delivery_date: e.target.value})}
                  />
                </div>
              </div>

              {selectedWarehouse && nearbySuppliers.length > 0 && (
                <div className="nearby-suppliers">
                  <h4>Nearby Suppliers (within 50km)</h4>
                  <div className="suppliers-grid">
                    {nearbySuppliers.map(supplier => (
                      <div key={supplier.id} className="supplier-card">
                        <h5>{supplier.name}</h5>
                        <p>{supplier.company}</p>
                        <p><FiMapPin /> {supplier.distance_km}km away</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes"
                />
              </div>

              <div className="items-section">
                <h4>Request Items</h4>
                <div className="add-item-form">
                  <div className="item-inputs">
                    <select
                      value={newItem.product_id}
                      onChange={(e) => setNewItem({...newItem, product_id: e.target.value})}
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
                      value={newItem.quantity_required}
                      onChange={(e) => setNewItem({...newItem, quantity_required: e.target.value})}
                    />
                    <input
                      type="number"
                      placeholder="Predicted Unit Price"
                      value={newItem.predicted_unit_price}
                      onChange={(e) => setNewItem({...newItem, predicted_unit_price: e.target.value})}
                    />
                    <button onClick={addItem} className="add-item-btn">
                      <FiPlus /> Add Item
                    </button>
                  </div>
                </div>

                {formData.items.length > 0 && (
                  <div className="items-list">
                    {formData.items.map((item, index) => {
                      const product = products.find(p => p.id == item.product_id);
                      return (
                        <div key={index} className="item-row">
                          <span>{product?.name || 'Unknown Product'}</span>
                          <span>Qty: {item.quantity_required}</span>
                          <span>${item.predicted_unit_price}</span>
                          <button onClick={() => removeItem(index)} className="remove-item-btn">
                            <FiTrash2 />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={createRequest} className="create-btn">
                Create Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Request Modal */}
      {showViewModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>Request Details</h2>
              <button onClick={() => setShowViewModal(false)} className="close-btn">
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="request-details-view">
                <div className="detail-section">
                  <h4>Basic Information</h4>
                  <p><strong>Request #:</strong> {selectedRequest.request_number}</p>
                  <p><strong>Title:</strong> {selectedRequest.title}</p>
                  <p><strong>Description:</strong> {selectedRequest.description}</p>
                  <p><strong>Status:</strong> {selectedRequest.status}</p>
                  <p><strong>Priority:</strong> {selectedRequest.priority}</p>
                </div>

                <div className="detail-section">
                  <h4>Project & Warehouse</h4>
                  <p><strong>Project:</strong> {selectedRequest.project_name}</p>
                  <p><strong>Warehouse:</strong> {selectedRequest.warehouse_name}</p>
                  <p><strong>Delivery Date:</strong> {new Date(selectedRequest.required_delivery_date).toLocaleDateString()}</p>
                </div>

                <div className="detail-section">
                  <h4>Items ({selectedRequest.items?.length || 0})</h4>
                  {selectedRequest.items?.map((item, index) => (
                    <div key={index} className="item-detail">
                      <p><strong>{item.product_name}</strong> ({item.product_sku})</p>
                      <p>Quantity: {item.quantity_required}</p>
                      <p>Predicted Price: ${item.predicted_unit_price}</p>
                      <p>Total: ${item.predicted_total_price}</p>
                      {item.specifications && <p>Specs: {item.specifications}</p>}
                    </div>
                  ))}
                </div>

                <div className="detail-section">
                  <h4>Financial Summary</h4>
                  <p><strong>Total Predicted Amount:</strong> ${selectedRequest.total_predicted_amount?.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowViewModal(false)} className="cancel-btn">
                Close
              </button>
              {selectedRequest.quotes_count > 0 && (
                <button onClick={() => {
                  setShowViewModal(false);
                  viewQuotes(selectedRequest.id);
                }} className="view-quotes-btn">
                  View Quotes ({selectedRequest.quotes_count})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Quotes Modal */}
      {showQuotesModal && selectedRequest && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h2>Supplier Quotes</h2>
              <button onClick={() => setShowQuotesModal(false)} className="close-btn">
                <FiX />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="quotes-grid">
                {quotes.map(quote => (
                  <div key={quote.id} className="quote-card">
                    <div className="quote-header">
                      <h4>{quote.supplier_name}</h4>
                      <span className={`status-badge ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </div>
                    
                    <div className="quote-details">
                      <p><strong>Quote #:</strong> {quote.quote_number}</p>
                      <p><strong>Total Amount:</strong> ${quote.total_amount?.toFixed(2)}</p>
                      <p><strong>Delivery Cost:</strong> ${quote.delivery_cost?.toFixed(2)}</p>
                      <p><strong>Tax:</strong> ${quote.tax_amount?.toFixed(2)}</p>
                      <p><strong>Total with Tax:</strong> ${quote.total_with_tax?.toFixed(2)}</p>
                      <p><strong>Delivery Date:</strong> {new Date(quote.estimated_delivery_date).toLocaleDateString()}</p>
                      <p><strong>Items:</strong> {quote.items_count}</p>
                    </div>

                    <div className="quote-actions">
                      <button className="action-btn view">
                        <FiEye /> View Details
                      </button>
                      {quote.status === 'submitted' && (
                        <>
                          <button className="action-btn accept">
                            <FiCheck /> Accept
                          </button>
                          <button className="action-btn reject">
                            <FiX /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowQuotesModal(false)} className="cancel-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseRequests; 