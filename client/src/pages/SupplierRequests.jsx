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
    product_id: '',
    quantity: 1,
    unit_price: '',
    expected_delivery_date: '',
    delivery_address: ''
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

  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  // Add state for quotes
  const [quotes, setQuotes] = useState([]);
  const [showQuotesForRequest, setShowQuotesForRequest] = useState(null);

  // Add state for negotiations
  const [negotiations, setNegotiations] = useState([]);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [selectedNegotiation, setSelectedNegotiation] = useState(null);
  const [counterOfferForm, setCounterOfferForm] = useState({
    total_amount: 0,
    notes: '',
    items: []
  });
  
  // Add state for viewing offer details
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  
  // Add state for filtering
  const [activeFilter, setActiveFilter] = useState('all');

  // Fetch data
  useEffect(() => {
    fetch('http://localhost:5001/materials')
      .then(res => res.json())
      .then(data => setMaterials(data.filter(m => !m.model_name)));
    fetch('http://localhost:5001/warehouses')
      .then(res => res.json())
      .then(setWarehouses);
    fetchData();
    // Fetch all supplier-request-quotes for all requests
    fetch('http://localhost:5001/supplier-request-quotes')
      .then(res => res.json())
      .then(setQuotes);
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

      // Fetch shipping costs for accepted suppliers
      const requestsWithShipping = await Promise.all(
        requestsData.map(async (request) => {
          if (request.suppliers) {
            const suppliersWithShipping = await Promise.all(
              request.suppliers.map(async (supplier) => {
                if (supplier.status === 'accepted') {
                  try {
                    const subtotal = request.total_amount || 0;
                    const shippingResponse = await fetch(
                      `http://localhost:5001/supplier-shipping-cost/${supplier.id}?delivery_address=${encodeURIComponent(request.delivery_address || '')}&subtotal=${subtotal}&product_category=machinery`
                    );
                    if (shippingResponse.ok) {
                      const shippingData = await shippingResponse.json();
                      return {
                        ...supplier,
                        shipping_distance: shippingData.distance_km,
                        shipping_cost: shippingData.shipping_cost,
                        tax_breakdown: shippingData.tax_breakdown,
                        grand_total: shippingData.grand_total
                      };
                    }
                  } catch (error) {
                    console.error('Error fetching shipping cost:', error);
                  }
                }
                return supplier;
              })
            );
            return { ...request, suppliers: suppliersWithShipping };
          }
          return request;
        })
      );
      
      setRequests(requestsWithShipping);
      setSuppliers(suppliersData);
      setProjects(projectsData);
      setMasterProducts(Array.isArray(productsData) ? productsData.map(fp => ({ id: fp.id, name: fp.model_name })) : []);
      setLoading(false);
    } catch (error) {
      setError('Failed to load data');
      setLoading(false);
    }
  };

  // Fetch negotiations for a specific request
  const fetchNegotiations = async (requestId) => {
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/negotiations`);
      const data = await response.json();
      setNegotiations(data);
    } catch (error) {
      console.error('Error fetching negotiations:', error);
    }
  };

  // Handle admin response to supplier offer
  const handleAdminResponse = async (requestId, supplierId, action, counterOffer = null) => {
    try {
      const response = await fetch(`http://localhost:5001/supplier-requests/${requestId}/admin-respond-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          action: action,
          counter_offer: counterOffer,
          notes: counterOfferForm.notes
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh data
        fetchData();
        fetchNegotiations(requestId);
        setShowNegotiationModal(false);
        setSelectedNegotiation(null);
        setCounterOfferForm({ total_amount: 0, notes: '', items: [] });
      } else {
        setError(result.error || 'Failed to respond to offer');
      }
    } catch (error) {
      setError('Failed to respond to offer');
    }
  };

  // View offer details
  const viewOfferDetails = async (requestId, supplierId) => {
    try {
      // Fetch both the request details and negotiations
      const [requestResponse, negotiationsResponse] = await Promise.all([
        fetch(`http://localhost:5001/supplier-requests/${requestId}`),
        fetch(`http://localhost:5001/supplier-requests/${requestId}/negotiations`)
      ]);
      
      const requestData = await requestResponse.json();
      const negotiations = await negotiationsResponse.json();
      
      // Find the latest revised offer from this supplier
      const latestOffer = negotiations.find(n => 
        n.offer_type === 'revised_offer' && 
        n.supplier_id === supplierId
      );
      
      if (latestOffer) {
        setSelectedOffer({
          requestId,
          supplierId,
          supplierName: latestOffer.supplier_name,
          originalRequest: requestData,
          offer: latestOffer
        });
        setShowOfferModal(true);
      } else {
        setError('No revised offer found for this supplier');
      }
    } catch (error) {
      setError('Failed to load offer details');
    }
  };

  // Filter requests based on active filter
  const getFilteredRequests = () => {
    if (activeFilter === 'all') {
      return requests.filter(request => request.status !== 'draft');
    }
    
    return requests.filter(request => {
      if (request.status === 'draft') return false;
      
      if (!request.suppliers || request.suppliers.length === 0) {
        return activeFilter === 'pending';
      }
      
      switch (activeFilter) {
        case 'accepted':
          return request.suppliers.some(supplier => supplier.status === 'accepted');
        case 'rejected':
          return request.suppliers.some(supplier => supplier.status === 'rejected');
        case 'pending':
          return request.suppliers.every(supplier => supplier.status === 'pending');
        case 'revised_offers':
          return request.suppliers.some(supplier => supplier.status === 'revised_offer');
        default:
          return true;
      }
    });
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
      const [requestResponse, fulfillmentResponse] = await Promise.all([
        fetch(`http://localhost:5001/supplier-requests/${requestId}`),
        fetch(`http://localhost:5001/supplier-requests/${requestId}/fulfillment-status`)
      ]);
      
      const [requestData, fulfillmentData] = await Promise.all([
        requestResponse.json(),
        fulfillmentResponse.json()
      ]);
      
      // Merge fulfillment data with supplier data
      const enrichedData = {
        ...requestData,
        suppliers: requestData.suppliers.map(supplier => {
          const fulfillmentInfo = fulfillmentData.find(f => f.supplier_id === supplier.id);
          return {
            ...supplier,
            fulfillment_status: fulfillmentInfo?.fulfillment_status,
            packing_timestamp: fulfillmentInfo?.packing_timestamp,
            dispatched_timestamp: fulfillmentInfo?.dispatched_timestamp,
            delivered_timestamp: fulfillmentInfo?.delivered_timestamp
          };
        })
      };
      
      setSelectedRequest(enrichedData);
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

      {/* Supplier Response Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div style={{ 
          background: '#10b981', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {requests.filter(r => r.status !== 'draft' && r.suppliers?.some(s => s.status === 'accepted')).length}
          </div>
          <div style={{ fontSize: '14px' }}>Accepted Requests</div>
        </div>
        <div style={{ 
          background: '#e74c3c', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {requests.filter(r => r.status !== 'draft' && r.suppliers?.some(s => s.status === 'rejected')).length}
          </div>
          <div style={{ fontSize: '14px' }}>Rejected Requests</div>
        </div>
        <div style={{ 
          background: '#f59e42', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {requests.filter(r => r.status !== 'draft' && r.suppliers?.every(s => s.status === 'pending')).length}
          </div>
          <div style={{ fontSize: '14px' }}>Pending Requests</div>
        </div>
        <div style={{ 
          background: '#8b5cf6', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {requests.filter(r => r.status !== 'draft' && r.suppliers?.some(s => s.status === 'revised_offer')).length}
          </div>
          <div style={{ fontSize: '14px' }}>Revised Offers</div>
        </div>
        <div style={{ 
          background: '#3b82f6', 
          color: 'white', 
          padding: '16px', 
          borderRadius: '8px', 
          textAlign: 'center' 
        }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {requests.filter(r => r.status !== 'draft').length}
          </div>
          <div style={{ fontSize: '14px' }}>Total Requests</div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Filter Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <button
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            background: activeFilter === 'all' ? '#3b82f6' : '#f1f5f9',
            color: activeFilter === 'all' ? 'white' : '#64748b',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setActiveFilter('all')}
        >
          📋 All Requests ({requests.filter(r => r.status !== 'draft').length})
        </button>
        
        <button
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            background: activeFilter === 'accepted' ? '#10b981' : '#f1f5f9',
            color: activeFilter === 'accepted' ? 'white' : '#64748b',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setActiveFilter('accepted')}
        >
          ✅ Accepted ({requests.filter(r => r.status !== 'draft' && r.suppliers?.some(s => s.status === 'accepted')).length})
        </button>
        
        <button
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            background: activeFilter === 'rejected' ? '#e74c3c' : '#f1f5f9',
            color: activeFilter === 'rejected' ? 'white' : '#64748b',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setActiveFilter('rejected')}
        >
          ❌ Rejected ({requests.filter(r => r.status !== 'draft' && r.suppliers?.some(s => s.status === 'rejected')).length})
        </button>
        
        <button
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            background: activeFilter === 'pending' ? '#f59e42' : '#f1f5f9',
            color: activeFilter === 'pending' ? 'white' : '#64748b',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setActiveFilter('pending')}
        >
          ⏳ Pending ({requests.filter(r => r.status !== 'draft' && r.suppliers?.every(s => s.status === 'pending')).length})
        </button>
        
        <button
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            background: activeFilter === 'revised_offers' ? '#8b5cf6' : '#f1f5f9',
            color: activeFilter === 'revised_offers' ? 'white' : '#64748b',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setActiveFilter('revised_offers')}
        >
          📝 Revised Offers ({requests.filter(r => r.status !== 'draft' && r.suppliers?.some(s => s.status === 'revised_offer')).length})
        </button>
      </div>

      <div className="requests-grid">
        {getFilteredRequests().map(request => (
          <div key={request.id} className="supplier-request-card">
            <div className="request-header">
              <div className="request-info">
                <h3>{request.title}</h3>
                <p className="request-number">{request.request_number}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              <div className="request-status" style={{ color: getStatusColor(request.status) }}>
                {React.createElement(getStatusIcon(request.status))}
                <span>{request.status.replace('_', ' ').toUpperCase()}</span>
                </div>
                {/* Supplier Response Summary */}
                {request.suppliers && request.suppliers.length > 0 && (
                  <div style={{ 
                    background: '#f8f9fa', 
                    border: '1px solid #dee2e6', 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '11px', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {(() => {
                      const acceptedSupplier = request.suppliers.find(s => s.status === 'accepted');
                      if (acceptedSupplier) {
                        return `✅ ${acceptedSupplier.name} - In Progress`;
                      } else {
                        return `📊 ${request.suppliers.filter(s => s.status === 'accepted').length} Accepted, ${request.suppliers.filter(s => s.status === 'rejected').length} Rejected, ${request.suppliers.filter(s => s.status === 'pending').length} Pending`;
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="request-details">
              <div className="detail-row">
                <span className="label">Suppliers:</span>
                <span>{request.suppliers && request.suppliers.length > 0 ? request.suppliers.map(s => s.name).join(', ') : 'None'}</span>
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
              {/* Supplier Response and Fulfillment Tracker */}
              {request.suppliers && request.suppliers.length > 0 && (
                <div className="detail-row">
                  <span className="label">Supplier Status:</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Check if any supplier has accepted */}
                    {(() => {
                      const acceptedSupplier = request.suppliers.find(s => s.status === 'accepted');
                      if (acceptedSupplier) {
                        // Show accepted supplier with fulfillment tracker
                        return (
                          <div>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              fontSize: '13px',
                              marginBottom: '12px'
                            }}>
                              <span style={{ fontWeight: 500 }}>✅ {acceptedSupplier.name} (Accepted)</span>
                            </div>
                            
                            {/* Fulfillment Tracker */}
                            <div style={{ 
                              background: '#f8f9fa', 
                              border: '1px solid #dee2e6', 
                              borderRadius: '8px', 
                              padding: '12px',
                              marginTop: '8px'
                            }}>
                              <div style={{ 
                                fontSize: '12px', 
                                fontWeight: 600, 
                                color: '#666', 
                                marginBottom: '8px' 
                              }}>
                                Fulfillment Progress
                              </div>
                              <AdminFulfillmentTracker 
                                currentStatus={acceptedSupplier.fulfillment_status || 'accepted'}
                                packingTimestamp={acceptedSupplier.packing_timestamp}
                                dispatchedTimestamp={acceptedSupplier.dispatched_timestamp}
                                deliveredTimestamp={acceptedSupplier.delivered_timestamp}
                                supplierName={acceptedSupplier.name}
                              />
                            </div>
                          </div>
                        );
                      } else {
                        // Show all supplier responses when no one has accepted
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {request.suppliers.map(supplier => (
                              <div key={supplier.id} style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                fontSize: '13px'
                              }}>
                                <span style={{ fontWeight: 500 }}>{supplier.name}:</span>
                                <span style={{ 
                                  color: supplier.status === 'accepted' ? '#10b981' : 
                                         supplier.status === 'rejected' ? '#e74c3c' : 
                                         supplier.status === 'pending' ? '#f59e42' : 
                                         supplier.status === 'revised_offer' ? '#3b82f6' :
                                         supplier.status === 'counter_offered' ? '#8b5cf6' : '#bbb',
                                  fontWeight: 600
                                }}>
                                  {supplier.status === 'accepted' ? '✅ Accepted' :
                                   supplier.status === 'rejected' ? '❌ Rejected' :
                                   supplier.status === 'pending' ? '⏳ Pending' :
                                   supplier.status === 'revised_offer' ? '📝 Revised Offer' :
                                   supplier.status === 'counter_offered' ? '💼 Counter Offered' :
                                   supplier.status?.replace('_', ' ').toUpperCase() || 'Unknown'}
                                </span>
                                
                                {/* Action buttons for revised offers */}
                                {supplier.status === 'revised_offer' && (
                                  <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                    <button 
                                      style={{ 
                                        background: '#3b82f6', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        padding: '2px 6px', 
                                        fontSize: '10px',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => viewOfferDetails(request.id, supplier.id)}
                                    >
                                      View Offer
                                    </button>
                                    <button 
                                      style={{ 
                                        background: '#10b981', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        padding: '2px 6px', 
                                        fontSize: '10px',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => handleAdminResponse(request.id, supplier.id, 'accept')}
                                    >
                                      Accept
                                    </button>
                                    <button 
                                      style={{ 
                                        background: '#e74c3c', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        padding: '2px 6px', 
                                        fontSize: '10px',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => handleAdminResponse(request.id, supplier.id, 'reject')}
                                    >
                                      Reject
                                    </button>
                                    <button 
                                      style={{ 
                                        background: '#f59e42', 
                                        color: 'white', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        padding: '2px 6px', 
                                        fontSize: '10px',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => {
                                        setSelectedNegotiation({ requestId: request.id, supplierId: supplier.id });
                                        fetchNegotiations(request.id);
                                        setShowNegotiationModal(true);
                                      }}
                                    >
                                      Counter
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="request-actions">
              <button 
                className="action-btn view"
                onClick={() => viewRequest(request.id)}
              >
                <FaEye />
                View Details
              </button>
              
              {/* Shipping & Tax Information */}
              {request.suppliers && request.suppliers.some(s => s.status === 'accepted') && (
                <div style={{ 
                  background: '#1f2937', 
                  padding: '8px 12px', 
                  borderRadius: '6px', 
                  marginTop: '8px',
                  border: '1px solid #374151'
                }}>
                  <div style={{ color: '#10b981', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                    🚚 Shipping & Tax Information
                  </div>
                  {request.suppliers.map(supplier => {
                    if (supplier.status === 'accepted') {
                      return (
                        <div key={supplier.id} style={{ color: '#d1d5db', fontSize: '10px', marginBottom: '2px' }}>
                          <div>{supplier.name}:</div>
                          <div style={{ marginLeft: '8px' }}>
                            Distance: {supplier.shipping_distance || 'Calculating...'} km
                          </div>
                          <div style={{ marginLeft: '8px' }}>
                            Shipping: ₹{supplier.shipping_cost ? supplier.shipping_cost.toLocaleString() : 'Calculating...'}
                          </div>
                          {supplier.tax_breakdown && (
                            <>
                              <div style={{ marginLeft: '8px' }}>
                                Tax: ₹{supplier.tax_breakdown.total_tax ? supplier.tax_breakdown.total_tax.toLocaleString() : 'Calculating...'}
                              </div>
                              <div style={{ marginLeft: '8px', fontWeight: '600' }}>
                                Total: ₹{supplier.grand_total ? supplier.grand_total.toLocaleString() : 'Calculating...'}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
              
              {/* Download Invoice Button - Only show for delivered requests */}
              {request.suppliers && request.suppliers.some(s => s.status === 'accepted' && s.fulfillment_status === 'delivered') && (
                <button 
                  className="action-btn"
                  style={{ 
                    background: '#10b981', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    padding: '8px 12px', 
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '8px'
                  }}
                  onClick={() => {
                    const acceptedSupplier = request.suppliers.find(s => s.status === 'accepted');
                    if (acceptedSupplier) {
                      window.open(`http://localhost:5001/supplier-requests/${request.id}/download-invoice/${acceptedSupplier.id}`, '_blank');
                    }
                  }}
                >
                  📄 Download Invoice
                </button>
              )}
            </div>
            {/* Supplier Quotes & Order Status Section */}
            <div className="supplier-quotes-status-section" style={{ background: '#181818', borderRadius: 12, marginTop: 16, padding: 16 }}>
              <h4 style={{ color: '#fff', marginBottom: 8 }}>Supplier Quotes & Order Status</h4>
              {quotes.filter(q => q.request_id === request.id).length === 0 ? (
                <div style={{ color: '#bbb' }}>No quotes submitted yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {quotes.filter(q => q.request_id === request.id).map(q => {
                    // Timeline steps
                    const steps = [
                      { label: 'Quote Sent', done: true, date: q.created_at },
                      { label: 'Accepted', done: q.status === 'agreed' || q.status === 'packing' || q.status === 'dispatched', date: q.status === 'agreed' || q.status === 'packing' || q.status === 'dispatched' ? q.updated_at : null },
                      { label: 'Packed', done: q.status === 'packing' || q.status === 'dispatched', date: q.packed_date },
                      { label: 'Dispatched', done: q.status === 'dispatched', date: q.dispatched_date }
                    ];
                    // Delay logic
                    const expectedDelivery = request.expected_delivery_date ? new Date(request.expected_delivery_date) : null;
                    const packedLate = expectedDelivery && q.packed_date && new Date(q.packed_date) > expectedDelivery;
                    const dispatchedLate = expectedDelivery && q.dispatched_date && new Date(q.dispatched_date) > expectedDelivery;
                    return (
                      <div key={q.id} style={{ background: '#222', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{q.supplier_name || q.supplier_id}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 8 }}>
                          {steps.map((step, idx) => (
                            <div key={step.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                              <div style={{ width: 24, height: 24, borderRadius: 12, background: step.done ? '#10b981' : '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{idx + 1}</div>
                              <div style={{ color: step.done ? '#10b981' : '#bbb', fontSize: 12, marginTop: 4 }}>{step.label}</div>
                              {step.date && <div style={{ color: '#bbb', fontSize: 10 }}>{new Date(step.date).toLocaleDateString()}</div>}
                              {idx < steps.length - 1 && <div style={{ width: 2, height: 24, background: step.done ? '#10b981' : '#444', margin: '4px 0' }} />}
                            </div>
                          ))}
                        </div>
                        <div style={{ color: '#fff', fontSize: 13, marginBottom: 4 }}>Status: <b style={{ color: q.status === 'agreed' ? '#10b981' : q.status === 'packing' ? '#f59e42' : q.status === 'dispatched' ? '#3b82f6' : q.status === 'rejected' ? '#e74c3c' : '#bbb' }}>{q.status.charAt(0).toUpperCase() + q.status.slice(1)}</b></div>
                        {packedLate && <div style={{ color: '#eab308', fontSize: 12 }}>Packed after expected delivery date!</div>}
                        {dispatchedLate && <div style={{ color: '#eab308', fontSize: 12 }}>Dispatched after expected delivery date!</div>}
                        <div style={{ color: '#bbb', fontSize: 12 }}>Quote Amount: <b style={{ color: '#fff' }}>{q.total_amount}</b></div>
                      </div>
                    );
                  })}
                </div>
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
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              if (!user || !user.user_id) {
                setError('User not logged in or missing user ID.');
                return;
              }
              // Fetch all suppliers who supply the selected material
              const res = await fetch(`http://localhost:5001/supplier-products-by-material/${requestForm.product_id}`);
              const supplierProducts = await res.json();
              if (!Array.isArray(supplierProducts) || supplierProducts.length === 0) {
                setError('No suppliers found for this material.');
                return;
              }
              const supplierIds = supplierProducts.map(sp => sp.supplier_id);
              const selectedWarehouse = warehouses.find(w => w.id == requestForm.delivery_address);
              const response = await fetch('http://localhost:5001/supplier-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: `Request for ${materials.find(m => m.id == requestForm.product_id)?.name || ''}`,
                  requester_id: parseInt(user.user_id, 10),
                  supplier_ids: supplierIds,
                  expected_delivery_date: requestForm.expected_delivery_date,
                  delivery_address: selectedWarehouse ? selectedWarehouse.location : '',
                  priority: 'medium',
                  status: 'pending',
                  items: [{
                    product_id: requestForm.product_id,
                    quantity: requestForm.quantity,
                    unit_price: requestForm.unit_price
                  }]
                })
              });
              const data = await response.json();
              if (data.success) {
                setShowCreateModal(false);
                setRequestForm({ product_id: '', quantity: 1, unit_price: '', expected_delivery_date: '', delivery_address: '' });
                fetchData();
              } else {
                setError(data.error || 'Failed to create request');
              }
            }} className="request-form">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Material *</label>
                  <select
                    value={requestForm.product_id}
                    onChange={e => setRequestForm({ ...requestForm, product_id: e.target.value })}
                    required
                  >
                    <option value="">Select material...</option>
                    {materials.map(material => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={requestForm.quantity}
                    onChange={e => setRequestForm({ ...requestForm, quantity: parseFloat(e.target.value) || 1 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tentative Price (per unit) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={requestForm.unit_price}
                    onChange={e => setRequestForm({ ...requestForm, unit_price: parseFloat(e.target.value) || '' })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Required Delivery Date *</label>
                  <input
                    type="date"
                    value={requestForm.expected_delivery_date}
                    onChange={e => setRequestForm({ ...requestForm, expected_delivery_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Delivery Location *</label>
                  <select
                    value={requestForm.delivery_address}
                    onChange={e => setRequestForm({ ...requestForm, delivery_address: e.target.value })}
                    required
                  >
                    <option value="">Select warehouse...</option>
                    {warehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name} ({wh.location})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="submit-btn">Create Request</button>
              </div>
              {error && <div className="error-banner">{error}</div>}
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
                      {typeof selectedRequest.status === 'string' ? selectedRequest.status.replace('_', ' ').toUpperCase() : ''}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Supplier Response:</label>
                    <span style={{ 
                      color: selectedRequest.status === 'accepted' ? '#10b981' : 
                             selectedRequest.status === 'rejected' ? '#e74c3c' : 
                             selectedRequest.status === 'pending' ? '#f59e42' : '#bbb',
                      fontWeight: 600,
                      fontSize: '14px'
                    }}>
                      {selectedRequest.status === 'accepted' ? '✅ Accepted by Supplier' :
                       selectedRequest.status === 'rejected' ? '❌ Rejected by Supplier' :
                       selectedRequest.status === 'pending' ? '⏳ Awaiting Supplier Response' :
                       selectedRequest.status === 'draft' ? '📝 Draft (Not Sent)' :
                       selectedRequest.status === 'sent' ? '📤 Sent to Supplier' :
                       selectedRequest.status === 'supplier_reviewing' ? '👀 Supplier Reviewing' :
                       selectedRequest.status === 'supplier_quoted' ? '💬 Quote Submitted' :
                       selectedRequest.status === 'admin_reviewing' ? '👨‍💼 Admin Reviewing' :
                       selectedRequest.status === 'approved' ? '✅ Approved' :
                       selectedRequest.status === 'confirmed' ? '✅ Confirmed' :
                       selectedRequest.status === 'in_production' ? '🏭 In Production' :
                       selectedRequest.status === 'ready_for_delivery' ? '📦 Ready for Delivery' :
                       selectedRequest.status === 'delivered' ? '🚚 Delivered' :
                       selectedRequest.status === 'cancelled' ? '❌ Cancelled' :
                       selectedRequest.status?.replace('_', ' ').toUpperCase() || 'Unknown'}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Suppliers:</label>
                    <span>{selectedRequest.suppliers && selectedRequest.suppliers.length > 0 ? selectedRequest.suppliers.map(s => s.name).join(', ') : 'None'}</span>
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

      {/* Quotes Section */}
      {showQuotesForRequest && (
        <div className="quotes-section-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.7)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
          <div style={{ background: '#181818', borderRadius: 12, padding: 24, minWidth: 400, maxWidth: 600, boxShadow: '0 8px 32px #000a', position: 'relative' }}>
            <button
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: '#222',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 20,
                width: 32,
                height: 32,
                cursor: 'pointer',
                zIndex: 10,
              }}
              onClick={() => setShowQuotesForRequest(null)}
              aria-label="Close quotes section"
            >
              ×
            </button>
            <h3 style={{ color: '#fff', marginTop: 0 }}>Supplier Quotes for Request #{showQuotesForRequest}</h3>
            {quotes.length === 0 ? <div style={{ color: '#bbb' }}>No quotes submitted yet.</div> : (
              <table style={{ width: '100%', color: '#fff', marginTop: 16 }}>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Fulfillment Date</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Packed Date</th>
                    <th>Dispatched Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map(q => (
                    <tr key={q.id}>
                      <td>{q.supplier_name || q.supplier_id}</td>
                      <td>{q.fulfillment_date ? new Date(q.fulfillment_date).toLocaleDateString() : '-'}</td>
                      <td>{q.total_amount}</td>
                      <td style={{color: q.status === 'packing' ? '#f59e42' : q.status === 'dispatched' ? '#3b82f6' : undefined}}>
                        {q.status === 'packing' ? 'Packing' : q.status === 'dispatched' ? 'Dispatched' : q.status === 'agreed' ? 'Order Received' : q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                      </td>
                      <td>{q.packed_date ? new Date(q.packed_date).toLocaleDateString() : '-'}</td>
                      <td>{q.dispatched_date ? new Date(q.dispatched_date).toLocaleDateString() : '-'}</td>
                      <td>
                        {((q.status === 'pending' || q.status === 'submitted') && !quotes.some(qq => qq.status === 'agreed')) && (
                          <>
                            <button
                              className="action-btn"
                              style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', marginRight: 8 }}
                              onClick={async () => {
                                await fetch(`http://localhost:5001/supplier-request-quotes/${q.id}/status`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'agreed' })
                                });
                                fetchData(); // Re-fetch all quotes to update the persistent section
                              }}
                            >
                              Agree
                            </button>
                            <button
                              className="action-btn"
                              style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                              onClick={async () => {
                                await fetch(`http://localhost:5001/supplier-request-quotes/${q.id}/status`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'rejected' })
                                });
                                fetchData(); // Re-fetch all quotes to update the persistent section
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {quotes.some(qq => qq.status === 'agreed') && q.status !== 'agreed' && (
                          <span style={{ color: '#aaa' }}>Order Expired</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Offer Details Modal */}
      {showOfferModal && selectedOffer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Revised Offer Details - {selectedOffer.supplierName}</h3>
              <button className="close-btn" onClick={() => {
                setShowOfferModal(false);
                setSelectedOffer(null);
              }}>×</button>
            </div>
            
            <div style={{ padding: '20px' }}>
              {/* Comparison Header */}
              <div style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                color: 'white',
                borderRadius: '8px', 
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: 0, marginBottom: '8px' }}>📊 Offer Comparison</h3>
                <p style={{ margin: 0, opacity: 0.9 }}>Original Request vs. Revised Offer from {selectedOffer.supplierName}</p>
              </div>

              {/* Comparison Summary */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginBottom: '20px'
              }}>
                {/* Original Request */}
                <div style={{ 
                  background: '#f8f9fa', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '8px', 
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ color: '#333', margin: 0 }}>📋 Original Request</h4>
                    <div style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      background: '#e3f2fd',
                      color: '#1976d2'
                    }}>
                      REQUEST
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#666' }}>Total Amount:</strong>
                    <div style={{ color: '#333', fontSize: '18px', fontWeight: '600' }}>
                      ₹{selectedOffer.originalRequest.total_amount || 0}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#666' }}>Created:</strong>
                    <div style={{ color: '#333' }}>
                      {new Date(selectedOffer.originalRequest.created_at).toLocaleString()}
                    </div>
                  </div>
                  
                  {selectedOffer.originalRequest.notes && (
                    <div style={{ marginTop: '12px' }}>
                      <strong style={{ color: '#666' }}>Notes:</strong>
                      <div style={{ color: '#333', marginTop: '4px', padding: '8px', background: 'white', borderRadius: '4px', fontSize: '14px' }}>
                        {selectedOffer.originalRequest.notes}
                      </div>
                    </div>
                  )}
                </div>

                {/* Revised Offer */}
                <div style={{ 
                  background: '#fff3cd', 
                  border: '1px solid #ffc107', 
                  borderRadius: '8px', 
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ color: '#333', margin: 0 }}>📝 Revised Offer</h4>
                    <div style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      background: '#fff3cd',
                      color: '#856404'
                    }}>
                      {selectedOffer.offer.status}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#666' }}>Total Amount:</strong>
                    <div style={{ color: '#333', fontSize: '18px', fontWeight: '600' }}>
                      ₹{selectedOffer.offer.total_amount}
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#666' }}>Submitted:</strong>
                    <div style={{ color: '#333' }}>
                      {new Date(selectedOffer.offer.created_at).toLocaleString()}
                    </div>
                  </div>
                  
                  {selectedOffer.offer.notes && (
                    <div style={{ marginTop: '12px' }}>
                      <strong style={{ color: '#666' }}>Notes:</strong>
                      <div style={{ color: '#333', marginTop: '4px', padding: '8px', background: 'white', borderRadius: '4px', fontSize: '14px' }}>
                        {selectedOffer.offer.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Difference Indicator */}
              <div style={{ 
                background: '#f8f9fa', 
                border: '1px solid #dee2e6', 
                borderRadius: '8px', 
                padding: '16px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                {(() => {
                  const originalAmount = selectedOffer.originalRequest.total_amount || 0;
                  const revisedAmount = selectedOffer.offer.total_amount;
                  const difference = revisedAmount - originalAmount;
                  const percentageChange = originalAmount > 0 ? ((difference / originalAmount) * 100) : 0;
                  
                  return (
                    <div>
                      <h4 style={{ color: '#333', margin: '0 0 8px 0' }}>💰 Price Comparison</h4>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#666', fontSize: '14px' }}>Original</div>
                          <div style={{ color: '#333', fontSize: '20px', fontWeight: '600' }}>₹{originalAmount}</div>
                        </div>
                        <div style={{ fontSize: '24px', color: '#666' }}>→</div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: '#666', fontSize: '14px' }}>Revised</div>
                          <div style={{ color: '#333', fontSize: '20px', fontWeight: '600' }}>₹{revisedAmount}</div>
                        </div>
                        <div style={{ 
                          padding: '8px 16px', 
                          borderRadius: '20px', 
                          fontSize: '14px',
                          fontWeight: '600',
                          background: difference > 0 ? '#f8d7da' : '#d4edda',
                          color: difference > 0 ? '#721c24' : '#155724'
                        }}>
                          {difference > 0 ? '+' : ''}₹{difference} ({percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%)
                        </div>
                      </div>
    </div>
  );
                })()}
              </div>

              {/* Items Comparison */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#333', marginBottom: '12px' }}>📦 Items Comparison</h4>
                {selectedOffer.offer.items && selectedOffer.offer.items.length > 0 ? (
                  <div style={{ 
                    border: '1px solid #dee2e6', 
                    borderRadius: '8px', 
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa' }}>
                          <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #dee2e6', color: '#333' }}>Product</th>
                          <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #dee2e6', color: '#333' }}>Quantity</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6', color: '#333' }}>Original Price</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6', color: '#333' }}>Revised Price</th>
                          <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #dee2e6', color: '#333' }}>Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOffer.offer.items.map((item, index) => {
                          // Find corresponding original item
                          const originalItem = selectedOffer.originalRequest.items?.find(oi => oi.product_id === item.product_id);
                          const originalPrice = originalItem?.unit_price || 0;
                          const priceDifference = item.unit_price - originalPrice;
                          const percentageChange = originalPrice > 0 ? ((priceDifference / originalPrice) * 100) : 0;
                          
                          return (
                            <tr key={item.id} style={{ borderBottom: index < selectedOffer.offer.items.length - 1 ? '1px solid #f1f3f4' : 'none' }}>
                              <td style={{ padding: '12px', color: '#333' }}>
                                <div style={{ fontWeight: '500' }}>{item.product_name}</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>SKU: {item.product_sku}</div>
                                {item.specifications && (
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                    Specs: {item.specifications}
                                  </div>
                                )}
                                {item.notes && (
                                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
                                    Note: {item.notes}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', color: '#333' }}>{item.quantity}</td>
                              <td style={{ padding: '12px', textAlign: 'right', color: '#333' }}>₹{originalPrice}</td>
                              <td style={{ padding: '12px', textAlign: 'right', color: '#333' }}>₹{item.unit_price}</td>
                              <td style={{ padding: '12px', textAlign: 'right' }}>
                                <div style={{ 
                                  color: priceDifference > 0 ? '#e74c3c' : '#10b981',
                                  fontWeight: '500',
                                  fontSize: '14px'
                                }}>
                                  {priceDifference > 0 ? '+' : ''}₹{priceDifference}
                                </div>
                                <div style={{ 
                                  color: priceDifference > 0 ? '#e74c3c' : '#10b981',
                                  fontSize: '12px'
                                }}>
                                  ({percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%)
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f8f9fa' }}>
                          <td colSpan="2" style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#333' }}>
                            Total Amount:
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#333' }}>
                            ₹{selectedOffer.originalRequest.total_amount || 0}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#333' }}>
                            ₹{selectedOffer.offer.total_amount}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>
                            <div style={{ 
                              color: (selectedOffer.offer.total_amount - (selectedOffer.originalRequest.total_amount || 0)) > 0 ? '#e74c3c' : '#10b981',
                              fontSize: '14px'
                            }}>
                              {(() => {
                                const diff = selectedOffer.offer.total_amount - (selectedOffer.originalRequest.total_amount || 0);
                                return diff > 0 ? '+' : '' + '₹' + diff;
                              })()}
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>No items found in this offer.</div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                borderTop: '1px solid #dee2e6',
                paddingTop: '20px'
              }}>
                <button 
                  style={{ 
                    background: '#10b981', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    padding: '10px 20px', 
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                  onClick={() => {
                    handleAdminResponse(selectedOffer.requestId, selectedOffer.supplierId, 'accept');
                    setShowOfferModal(false);
                    setSelectedOffer(null);
                  }}
                >
                  ✅ Accept Offer
                </button>
                <button 
                  style={{ 
                    background: '#e74c3c', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    padding: '10px 20px', 
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                  onClick={() => {
                    handleAdminResponse(selectedOffer.requestId, selectedOffer.supplierId, 'reject');
                    setShowOfferModal(false);
                    setSelectedOffer(null);
                  }}
                >
                  ❌ Reject Offer
                </button>
                <button 
                  style={{ 
                    background: '#f59e42', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '6px', 
                    padding: '10px 20px', 
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                  onClick={() => {
                    setShowOfferModal(false);
                    setSelectedOffer(null);
                    setSelectedNegotiation({ 
                      requestId: selectedOffer.requestId, 
                      supplierId: selectedOffer.supplierId 
                    });
                    fetchNegotiations(selectedOffer.requestId);
                    setShowNegotiationModal(true);
                  }}
                >
                  💼 Send Counter Offer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Negotiation Modal */}
      {showNegotiationModal && selectedNegotiation && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>Negotiation - Counter Offer</h3>
              <button className="close-btn" onClick={() => {
                setShowNegotiationModal(false);
                setSelectedNegotiation(null);
                setCounterOfferForm({ total_amount: 0, notes: '', items: [] });
              }}>×</button>
            </div>
            
            <div style={{ padding: '20px' }}>
              {/* Negotiation History */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ color: '#333', marginBottom: '12px' }}>Negotiation History</h4>
                {negotiations.length === 0 ? (
                  <div style={{ color: '#666' }}>No negotiations found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {negotiations.map((negotiation, index) => (
                      <div key={negotiation.id} style={{ 
                        border: '1px solid #ddd', 
                        borderRadius: '8px', 
                        padding: '16px',
                        background: negotiation.offer_type === 'revised_offer' ? '#f8f9fa' : '#e3f2fd'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ fontWeight: 600, color: '#333' }}>
                            {negotiation.offer_type === 'revised_offer' ? '📝 Revised Offer' : '💼 Counter Offer'}
                            {negotiation.supplier_id === selectedNegotiation.supplierId ? ` (${negotiation.supplier_name})` : ''}
                          </div>
                          <div style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px',
                            background: negotiation.status === 'accepted' ? '#d4edda' : 
                                       negotiation.status === 'rejected' ? '#f8d7da' : '#fff3cd',
                            color: negotiation.status === 'accepted' ? '#155724' : 
                                   negotiation.status === 'rejected' ? '#721c24' : '#856404'
                          }}>
                            {negotiation.status}
                          </div>
                        </div>
                        
                        <div style={{ color: '#666', marginBottom: '8px' }}>
                          <strong>Total Amount:</strong> ₹{negotiation.total_amount}
                        </div>
                        
                        {negotiation.notes && (
                          <div style={{ color: '#666', marginBottom: '8px' }}>
                            <strong>Notes:</strong> {negotiation.notes}
                          </div>
                        )}
                        
                        <div style={{ color: '#999', fontSize: '12px' }}>
                          {new Date(negotiation.created_at).toLocaleString()}
                        </div>

                        {/* Show items for this negotiation */}
                        {negotiation.items && negotiation.items.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <div style={{ color: '#666', marginBottom: '8px', fontWeight: 600 }}>Items:</div>
                            <table style={{ width: '100%', color: '#666', fontSize: '12px' }}>
                              <thead>
                                <tr>
                                  <th style={{ textAlign: 'left' }}>Product</th>
                                  <th style={{ textAlign: 'right' }}>Qty</th>
                                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                                  <th style={{ textAlign: 'right' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {negotiation.items.map(item => (
                                  <tr key={item.id}>
                                    <td>{item.product_name}</td>
                                    <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right' }}>₹{item.unit_price}</td>
                                    <td style={{ textAlign: 'right' }}>₹{item.total_price}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Counter Offer Form */}
              <div style={{ borderTop: '1px solid #ddd', paddingTop: '20px' }}>
                <h4 style={{ color: '#333', marginBottom: '16px' }}>Send Counter Offer</h4>
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', color: '#333' }}>Total Amount (₹)</label>
                  <input
                    type="number"
                    value={counterOfferForm.total_amount}
                    onChange={e => setCounterOfferForm({...counterOfferForm, total_amount: parseFloat(e.target.value) || 0})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="Enter total amount"
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', color: '#333' }}>Notes</label>
                  <textarea
                    value={counterOfferForm.notes}
                    onChange={e => setCounterOfferForm({...counterOfferForm, notes: e.target.value})}
                    rows="3"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                    placeholder="Add notes for the counter offer..."
                  />
                </div>

                {/* Counter offer items - simplified for now */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', color: '#333' }}>Items</label>
                  <div style={{ 
                    background: '#f8f9fa', 
                    border: '1px solid #ddd', 
                    borderRadius: '4px', 
                    padding: '12px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    <div>Using the same items as the original request</div>
                    <div style={{ marginTop: '8px', fontSize: '12px' }}>
                      <strong>Note:</strong> You can modify the unit prices to create your counter offer
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-btn"
                    onClick={() => {
                      setShowNegotiationModal(false);
                      setSelectedNegotiation(null);
                      setCounterOfferForm({ total_amount: 0, notes: '', items: [] });
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="submit-btn"
                    onClick={() => {
                      // Create counter offer items based on the latest revised offer
                      const latestRevisedOffer = negotiations.find(n => 
                        n.offer_type === 'revised_offer' && 
                        n.supplier_id === selectedNegotiation.supplierId
                      );
                      
                      if (latestRevisedOffer) {
                        const counterOfferItems = latestRevisedOffer.items.map(item => ({
                          product_id: item.product_id,
                          quantity: item.quantity,
                          unit_price: (counterOfferForm.total_amount / latestRevisedOffer.total_amount) * item.unit_price,
                          total_price: (counterOfferForm.total_amount / latestRevisedOffer.total_amount) * item.total_price,
                          specifications: item.specifications,
                          notes: item.notes
                        }));
                        
                        handleAdminResponse(
                          selectedNegotiation.requestId, 
                          selectedNegotiation.supplierId, 
                          'counter', 
                          {
                            total_amount: counterOfferForm.total_amount,
                            items: counterOfferItems
                          }
                        );
                      }
                    }}
                    disabled={!counterOfferForm.total_amount}
                  >
                    Send Counter Offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin Fulfillment Tracker Component
function AdminFulfillmentTracker({ currentStatus, packingTimestamp, dispatchedTimestamp, deliveredTimestamp, supplierName }) {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#fff', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
          Fulfillment Progress by {supplierName}:
        </div>
      </div>
      
      {/* Status Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '24px', 
            height: '24px', 
            borderRadius: '50%', 
            background: '#10b981', 
            color: 'white',
            fontSize: '12px',
            marginRight: '8px'
          }}>
            ✅
          </div>
          <div style={{ color: '#10b981', fontSize: '11px', fontWeight: '600' }}>Accepted</div>
          <div style={{ flex: 1, height: '2px', background: currentStatus !== 'accepted' ? '#10b981' : '#374151', margin: '0 8px' }}></div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '24px', 
            height: '24px', 
            borderRadius: '50%', 
            background: currentStatus === 'packing' || currentStatus === 'dispatched' || currentStatus === 'delivered' ? '#f59e42' : '#374151', 
            color: 'white',
            fontSize: '12px',
            marginRight: '8px'
          }}>
            📦
          </div>
          <div style={{ 
            color: currentStatus === 'packing' || currentStatus === 'dispatched' || currentStatus === 'delivered' ? '#f59e42' : '#6b7280', 
            fontSize: '11px', 
            fontWeight: '600' 
          }}>Packing</div>
          <div style={{ flex: 1, height: '2px', background: currentStatus === 'dispatched' || currentStatus === 'delivered' ? '#f59e42' : '#374151', margin: '0 8px' }}></div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '24px', 
            height: '24px', 
            borderRadius: '50%', 
            background: currentStatus === 'dispatched' || currentStatus === 'delivered' ? '#3b82f6' : '#374151', 
            color: 'white',
            fontSize: '12px',
            marginRight: '8px'
          }}>
            🚚
          </div>
          <div style={{ 
            color: currentStatus === 'dispatched' || currentStatus === 'delivered' ? '#3b82f6' : '#6b7280', 
            fontSize: '11px', 
            fontWeight: '600' 
          }}>Dispatched</div>
          <div style={{ flex: 1, height: '2px', background: currentStatus === 'delivered' ? '#3b82f6' : '#374151', margin: '0 8px' }}></div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '24px', 
            height: '24px', 
            borderRadius: '50%', 
            background: currentStatus === 'delivered' ? '#8b5cf6' : '#374151', 
            color: 'white',
            fontSize: '12px'
          }}>
            🎉
          </div>
          <div style={{ 
            color: currentStatus === 'delivered' ? '#8b5cf6' : '#6b7280', 
            fontSize: '11px', 
            fontWeight: '600' 
          }}>Delivered</div>
        </div>

        {/* Timestamps Section */}
        {(packingTimestamp || dispatchedTimestamp || deliveredTimestamp) && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '10px', 
            color: '#6b7280',
            padding: '8px 0',
            borderTop: '1px solid #374151'
          }}>
            {packingTimestamp && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#f59e42' }}>📦 Packing</div>
                <div>{formatTimestamp(packingTimestamp)}</div>
              </div>
            )}
            {dispatchedTimestamp && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#3b82f6' }}>🚚 Dispatched</div>
                <div>{formatTimestamp(dispatchedTimestamp)}</div>
              </div>
            )}
            {deliveredTimestamp && (
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#8b5cf6' }}>🎉 Delivered</div>
                <div>{formatTimestamp(deliveredTimestamp)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

