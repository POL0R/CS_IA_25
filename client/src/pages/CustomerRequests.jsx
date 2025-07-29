import React, { useState, useEffect } from 'react';
import Select from 'react-select/creatable';
import './CustomerRequests.css';

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

const CustomerRequests = () => {
  const user = getUser();
  // Use a valid customer_id: 6 (customer1) or 8 (customer2) if not logged in
  const customer_id = (user && user.role === 'customer' && user.user_id) ? user.user_id : 6;
  const isCustomer = user && user.role === 'customer';

  // Tab state
  const [activeTab, setActiveTab] = useState('place-order');

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
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDistance, setDeliveryDistance] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [proposedDeadline, setProposedDeadline] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [orderError, setOrderError] = useState('');
  const [loading, setLoading] = useState(false);

  // Customer requests state
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');
  const [responseLoading, setResponseLoading] = useState(false);

  const [filterOptions, setFilterOptions] = useState({
    application_tags: [],
    compliance_tags: [],
    features: []
  });

  // Add state for negotiation
  const [negotiationHistory, setNegotiationHistory] = useState([]);
  const [counterOfferAmount, setCounterOfferAmount] = useState('');
  const [counterOfferNotes, setCounterOfferNotes] = useState('');
  const [counterOfferLoading, setCounterOfferLoading] = useState(false);

  // Add state for customer-proposed price
  const [proposedPrice, setProposedPrice] = useState('');

  // Fetch customer requests instead of orders
  const fetchRequests = () => {
    fetch(`http://localhost:5001/customer_requests?customer_id=${customer_id}`)
      .then(res => res.json())
      .then(data => setRequests(data));
  };

  // Fetch negotiation history for a request
  const fetchNegotiationHistory = async (requestId) => {
    try {
      const res = await fetch(`http://localhost:5001/customer_requests/${requestId}/negotiations`);
      if (res.ok) {
        const data = await res.json();
        setNegotiationHistory(data.negotiations || []);
      } else {
        setNegotiationHistory([]);
      }
    } catch {
      setNegotiationHistory([]);
    }
  };

  useEffect(() => {
    fetchRequests();
    
    // Fetch application tags from the new endpoint
    fetch('http://localhost:5001/application-tags')
      .then(res => res.json())
      .then(data => {
        setFilterOptions(prev => ({
          ...prev,
          application_tags: data.map(tag => tag.name)
        }));
      })
      .catch(() => setFilterOptions(prev => ({ ...prev, application_tags: [] })));
    
    // Fetch compliance tags from the dedicated endpoint
    fetch('http://localhost:5001/compliance_tags')
      .then(res => res.json())
      .then(data => {
        setFilterOptions(prev => ({
          ...prev,
          compliance_tags: data.map(tag => tag.name)
        }));
      })
      .catch(() => setFilterOptions(prev => ({ ...prev, compliance_tags: [] })));
    
    // Fetch features from the dedicated endpoint
    fetch('http://localhost:5001/features')
      .then(res => res.json())
      .then(data => {
        setFilterOptions(prev => ({
          ...prev,
          features: data.map(feature => feature.name)
        }));
      })
      .catch(() => setFilterOptions(prev => ({ ...prev, features: [] })));
  }, []);

  // Filter requests by status
  const getPendingRequests = () => {
    return requests.filter(req => 
      ['submitted', 'manager_review', 'quoted'].includes(req.status)
    );
  };

  const getRespondedRequests = () => {
    return requests.filter(req => 
      ['customer_accepted', 'customer_declined'].includes(req.status)
    );
  };

  const getCompletedRequests = () => {
    return requests.filter(req => 
      ['in_transit', 'completed'].includes(req.status)
    );
  };

  // Get status badge color
  const getStatusBadgeColor = (status) => {
    const statusColors = {
      'submitted': '#f59e42',
      'manager_review': '#17a2b8',
      'quoted': '#007bff',
      'customer_accepted': '#28a745',
      'customer_declined': '#e74c3c',
      'in_transit': '#6f42c1',
      'completed': '#20c997'
    };
    return statusColors[status] || '#6c757d';
  };

  // Get status display text
  const getStatusDisplayText = (status) => {
    const statusTexts = {
      'submitted': 'Submitted',
      'manager_review': 'Under Review',
      'quoted': 'Quote Received',
      'customer_accepted': 'Accepted',
      'customer_declined': 'Declined',
      'in_transit': 'In Transit',
      'completed': 'Completed'
    };
    return statusTexts[status] || status;
  };

  // Handle quote response
  const handleQuoteResponse = async (requestId, response, notes = '') => {
    setResponseLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/customer_requests/${requestId}/customer_response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: response,
          revision_notes: notes
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        alert(result.message || 'Response submitted successfully!');
        setShowQuoteModal(false);
        setRevisionNotes('');
        setSelectedRequest(null);
        fetchRequests(); // Refresh the requests list
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setResponseLoading(false);
    }
  };

  // When opening quote modal, fetch negotiation history
  const handleViewQuote = (request) => {
    setSelectedRequest(request);
    setShowQuoteModal(true);
    fetchNegotiationHistory(request.id);
  };

  // Submit a customer counter-offer
  const handleCounterOffer = async () => {
    if (!counterOfferAmount || isNaN(Number(counterOfferAmount))) {
      alert('Please enter a valid counter-offer amount.');
      return;
    }
    setCounterOfferLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/customer_requests/${selectedRequest.id}/customer-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer_id,
          total_amount: Number(counterOfferAmount),
          notes: counterOfferNotes,
          items: [{
            product_id: selectedRequest.product_id,
            quantity: selectedRequest.quantity,
            unit_price: Number(counterOfferAmount) / (selectedRequest.quantity || 1),
            total_price: Number(counterOfferAmount),
            specifications: '',
            notes: counterOfferNotes
          }]
        })
      });
      if (res.ok) {
        alert('Counter-offer submitted!');
        setCounterOfferAmount('');
        setCounterOfferNotes('');
        setShowQuoteModal(false);
        setSelectedRequest(null);
        fetchRequests();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setCounterOfferLoading(false);
    }
  };

  // Smart order functionality (keeping existing code)
  const handleGetRecommendations = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5001/match-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqForm)
      });
      const data = await res.json();
      setRecommendations(data.matches || []);
    } catch (err) {
      console.error('Error getting recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = async (product) => {
    setSelectedProduct(product);
    setOrderQty(1);
    setIncludeInstall(false);
    setDeliveryAddress('');
    setDeliveryDistance(null);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setPriceBreakdown(null);
    setOrderStatus('');
    setOrderError('');
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/price-breakdown?product_id=${product.product_id}&qty=1&install=false&delivery_address=${encodeURIComponent(deliveryAddress)}`);
      const data = await res.json();
      setPriceBreakdown(data);
    } catch (err) {
      setOrderError('Failed to get price breakdown');
    } finally {
      setLoading(false);
    }
  };

  const getAddressSuggestions = async (query) => {
    if (!query.trim() || query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      if (mapboxToken) {
        // Use Mapbox API if token is available
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=IN&types=place,locality,neighborhood&limit=5`
        );
        const data = await response.json();
        
        if (data.features) {
          const suggestions = data.features.map(feature => ({
            id: feature.id,
            text: feature.place_name,
            coordinates: feature.center
          }));
          setAddressSuggestions(suggestions);
          setShowSuggestions(true);
        }
      } else {
        // Fallback: provide predefined suggestions for major Indian cities
        const majorCities = [
          'Mumbai, Maharashtra, India',
          'Delhi, India',
          'Bangalore, Karnataka, India',
          'Hyderabad, Telangana, India',
          'Chennai, Tamil Nadu, India',
          'Kolkata, West Bengal, India',
          'Pune, Maharashtra, India',
          'Ahmedabad, Gujarat, India',
          'Surat, Gujarat, India',
          'Jaipur, Rajasthan, India',
          'Lucknow, Uttar Pradesh, India',
          'Kanpur, Uttar Pradesh, India',
          'Nagpur, Maharashtra, India',
          'Indore, Madhya Pradesh, India',
          'Thane, Maharashtra, India',
          'Bhopal, Madhya Pradesh, India',
          'Visakhapatnam, Andhra Pradesh, India',
          'Patna, Bihar, India',
          'Vadodara, Gujarat, India',
          'Ghaziabad, Uttar Pradesh, India'
        ];
        
        const filteredCities = majorCities.filter(city => 
          city.toLowerCase().includes(query.toLowerCase())
        );
        
        const suggestions = filteredCities.map((city, index) => ({
          id: `city-${index}`,
          text: city,
          coordinates: null
        }));
        
        setAddressSuggestions(suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      setAddressSuggestions([]);
    }
  };

  const handleAddressSelect = (suggestion) => {
    setDeliveryAddress(suggestion.text);
    setShowSuggestions(false);
    setAddressSuggestions([]);
    
    // Calculate distance for selected address
    calculateDeliveryDistance(suggestion.text);
    
    // Update price breakdown
    if (selectedProduct) {
      setTimeout(() => handlePriceBreakdown(), 500);
    }
  };

  const calculateDeliveryDistance = async (address) => {
    if (!address.trim()) {
      setDeliveryDistance(null);
      setDistanceLoading(false);
      return;
    }
    
    setDistanceLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/calculate-delivery-distance?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveryDistance(data);
      } else {
        console.error('Error calculating distance:', res.status, res.statusText);
        setDeliveryDistance(null);
      }
    } catch (err) {
      console.error('Error calculating distance:', err);
      setDeliveryDistance(null);
    } finally {
      setDistanceLoading(false);
    }
  };

  const handlePriceBreakdown = async () => {
    if (!selectedProduct || !deliveryAddress.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5001/price-breakdown?product_id=${selectedProduct.product_id}&qty=${orderQty}&install=${includeInstall}&delivery_address=${encodeURIComponent(deliveryAddress)}`);
      const data = await res.json();
      setPriceBreakdown(data);
    } catch (err) {
      setOrderError('Failed to get price breakdown');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedProduct || !priceBreakdown) {
      setOrderError('Please select a product and get price breakdown first');
      return;
    }
    
    if (!deliveryAddress.trim()) {
      setOrderError('Delivery address is required');
      return;
    }
    
    if (!proposedDeadline) {
      setOrderError('Proposed deadline is required');
      return;
    }
    
    setLoading(true);
    setOrderError(''); // Clear any previous errors
    try {
      const res = await fetch('http://localhost:5001/customer_requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customer_id,
          product_id: selectedProduct.product_id,
          quantity: orderQty,
          expected_delivery: proposedDeadline,
          delivery_address: deliveryAddress,
          quoted_price: proposedPrice ? Number(proposedPrice) : priceBreakdown.product_base_price,
          notes: `Include Installation: ${includeInstall}.`
        })
      });
      
      if (res.ok) {
        setOrderStatus('Order placed successfully! We will review and provide a quote soon.');
        setSelectedProduct(null);
        setPriceBreakdown(null);
        setDeliveryAddress('');
        setProposedDeadline('');
        setOrderQty(1);
        setIncludeInstall(false);
        setProposedPrice('');
        fetchRequests(); // Refresh requests list
      } else {
        const error = await res.json();
        setOrderError(`Error: ${error.error}`);
      }
    } catch (err) {
      setOrderError('Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const getProductImage = (product) => {
    if (product.photo_url) {
      if (product.photo_url.startsWith('http://') || product.photo_url.startsWith('https://')) {
        return product.photo_url;
      }
      return `http://localhost:5001${product.photo_url}`;
    }
    return '/src/assets/react.svg';
  };

  const [detailsModal, setDetailsModal] = useState({ open: false, request: null, loading: false, error: '', distance: null, price: null });

  const handleViewDetails = async (request) => {
    setDetailsModal({ open: true, request, loading: true, error: '', distance: null, price: null });
    try {
      // Fetch distance
      let distance = null;
      if (request.delivery_address) {
        const res = await fetch(`http://localhost:5001/calculate-delivery-distance?address=${encodeURIComponent(request.delivery_address)}`);
        if (res.ok) distance = await res.json();
      }
      // Fetch price breakdown
      let price = null;
      if (request.product_id && request.delivery_address) {
        const res = await fetch(`http://localhost:5001/price-breakdown?product_id=${request.product_id}&qty=${request.quantity || 1}&install=false&delivery_address=${encodeURIComponent(request.delivery_address)}`);
        if (res.ok) price = await res.json();
      }
      setDetailsModal({ open: true, request, loading: false, error: '', distance, price });
    } catch (err) {
      setDetailsModal({ open: true, request, loading: false, error: 'Failed to fetch details', distance: null, price: null });
    }
  };

  const handleDownloadInvoice = async (request) => {
    // Implementation for downloading invoice
    console.log('Download invoice for request:', request);
  };

  const handleCancelOrder = (request) => {
    if (confirm(`Are you sure you want to cancel request #${request.id}?`)) {
      // Implementation for canceling request
      console.log('Cancel request:', request);
    }
  };

  // --- Render ---
  if (!isCustomer) {
    return <div style={{ padding: 32, color: 'red', fontWeight: 600 }}>Access denied. This page is only for customers.</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32, background: 'black', minHeight: '100vh', color: 'white' }}>
      <h1 style={{ marginBottom: 24, color: 'white', textAlign: 'center' }}>Customer Dashboard</h1>
      
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 32, 
        borderBottom: '2px solid #333',
        paddingBottom: 8
      }}>
        <button
          onClick={() => setActiveTab('place-order')}
          style={{
            background: activeTab === 'place-order' ? '#457b9d' : 'transparent',
            color: activeTab === 'place-order' ? 'white' : '#ccc',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 16,
            transition: 'all 0.2s'
          }}
        >
          📋 Place Request
        </button>
        <button
          onClick={() => setActiveTab('pending-requests')}
          style={{
            background: activeTab === 'pending-requests' ? '#457b9d' : 'transparent',
            color: activeTab === 'pending-requests' ? 'white' : '#ccc',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 16,
            transition: 'all 0.2s'
          }}
        >
          ⏳ Pending Requests ({getPendingRequests().length})
        </button>
        <button
          onClick={() => setActiveTab('responded-requests')}
          style={{
            background: activeTab === 'responded-requests' ? '#457b9d' : 'transparent',
            color: activeTab === 'responded-requests' ? 'white' : '#ccc',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 16,
            transition: 'all 0.2s'
          }}
        >
          📝 Responded Requests ({getRespondedRequests().length})
        </button>
        <button
          onClick={() => setActiveTab('completed-requests')}
          style={{
            background: activeTab === 'completed-requests' ? '#457b9d' : 'transparent',
            color: activeTab === 'completed-requests' ? 'white' : '#ccc',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 16,
            transition: 'all 0.2s'
          }}
        >
          ✅ Completed Requests ({getCompletedRequests().length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'place-order' && (
        <div>
          <h2 style={{marginBottom: 12, color: 'white'}}>Place Product Request</h2>
          <p style={{ color: '#ccc', marginBottom: 24, fontSize: 16 }}>
            Tell us your requirements and we'll suggest the best products for your needs. 
            Fill in the specifications below and get personalized recommendations.
          </p>
          <form onSubmit={handleGetRecommendations} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
            <Select
              name="application"
              placeholder="Application Tags"
              options={filterOptions.application_tags?.map(tag => ({ value: tag, label: tag })) || []}
              onChange={option => setReqForm(prev => ({ ...prev, application: option?.value || '' }))}
              styles={{ minWidth: 150 }}
            />
            <input
              type="number"
              placeholder="Power Load (kW)"
              value={reqForm.power_load_kw}
              onChange={e => setReqForm(prev => ({ ...prev, power_load_kw: e.target.value }))}
              style={{ width: 150, padding: '8px 12px', border: '1px solid #333', borderRadius: 4, background: '#222', color: 'white' }}
            />
            <input
              type="number"
              placeholder="Voltage Rating"
              value={reqForm.voltage_rating}
              onChange={e => setReqForm(prev => ({ ...prev, voltage_rating: e.target.value }))}
              style={{ width: 150, padding: '8px 12px', border: '1px solid #333', borderRadius: 4, background: '#222', color: 'white' }}
            />
            <Select
              name="phase_type"
              placeholder="Phase Type"
              options={[
                { value: 'Single', label: 'Single Phase' },
                { value: '3-phase', label: '3-Phase' }
              ]}
              onChange={option => setReqForm(prev => ({ ...prev, phase_type: option?.value || '' }))}
              styles={{ minWidth: 150 }}
            />
            <Select
              name="mount_type"
              placeholder="Mount Type"
              options={[
                { value: 'Indoor', label: 'Indoor' },
                { value: 'Outdoor', label: 'Outdoor' }
              ]}
              onChange={option => setReqForm(prev => ({ ...prev, mount_type: option?.value || '' }))}
              styles={{ minWidth: 150 }}
            />
            <Select
              name="compliance"
              placeholder="Compliance Tags"
              options={filterOptions.compliance_tags?.map(tag => ({ value: tag, label: tag })) || []}
              onChange={option => setReqForm(prev => ({ ...prev, compliance: option?.value || '' }))}
              styles={{ minWidth: 150 }}
            />
            <Select
              name="preferred_features"
              placeholder="Preferred Features"
              options={filterOptions.features?.map(feature => ({ value: feature, label: feature })) || []}
              onChange={option => setReqForm(prev => ({ ...prev, preferred_features: option?.value || '' }))}
              styles={{ minWidth: 150 }}
            />
            <button type="submit" disabled={loading} style={{ background: '#457b9d', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}>
              {loading ? 'Getting Recommendations...' : 'Get Recommendations'}
            </button>
          </form>

          {recommendations.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 16, color: 'white' }}>Recommended Products</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {recommendations.map(product => (
                  <div key={product.product_id} style={{
                    border: selectedProduct?.product_id === product.product_id ? '3px solid #457b9d' : '1px solid #ddd',
                    borderRadius: 8,
                    padding: 16,
                    width: 280,
                    cursor: 'pointer',
                    color: 'white',
                    background: 'black',
                    transition: 'all 0.2s'
                  }} onClick={() => handleSelectProduct(product)}>
                    <img src={getProductImage(product)} alt={product.model_name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4, marginBottom: 8 }} />
                    <h4 style={{ margin: '0 0 8px 0', color: '#fff' }}>{product.model_name}</h4>
                    <p style={{ margin: '0 0 8px 0', color: '#fff', fontSize: 14 }}>Base Price: ₹{product.total_cost}</p>
                    <p style={{ margin: '0 0 8px 0', color: '#fff', fontSize: 12 }}>Match Score: {product.match_score}%</p>
                    {product.application_tags && product.application_tags.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: 11, fontWeight: 600 }}>Applications:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {product.application_tags.map((tag, index) => (
                            <span key={index} style={{
                              background: '#e3f2fd',
                              color: '#1976d2',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 500
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {product.compliance_tags && product.compliance_tags.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: 11, fontWeight: 600 }}>Compliance:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {product.compliance_tags.map((tag, index) => (
                            <span key={index} style={{
                              background: '#fff3e0',
                              color: '#f57c00',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 500
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {product.features && product.features.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: 11, fontWeight: 600 }}>Features:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {product.features.map((feature, index) => (
                            <span key={index} style={{
                              background: '#f3e5f5',
                              color: '#7b1fa2',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 500
                            }}>
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedProduct && (
            <div style={{ border: '1px solid #333', borderRadius: 8, padding: 24, marginBottom: 24, background: '#111' }}>
              <h3 style={{ marginBottom: 16, color: 'white' }}>Selected Product Details</h3>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <img src={getProductImage(selectedProduct)} alt={selectedProduct.model_name} style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 4 }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 8px 0', color: 'white' }}>{selectedProduct.model_name}</h4>
                  <p style={{ margin: '0 0 8px 0', color: '#ccc', fontSize: 14 }}>Base Price: ₹{selectedProduct.total_cost}</p>
                  {selectedProduct.application_tags && selectedProduct.application_tags.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ margin: '0 0 4px 0', color: '#ccc', fontSize: 12, fontWeight: 600 }}>Applications:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {selectedProduct.application_tags.map((tag, index) => (
                          <span key={index} style={{
                            background: '#e3f2fd',
                            color: '#1976d2',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedProduct.compliance_tags && selectedProduct.compliance_tags.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ margin: '0 0 4px 0', color: '#ccc', fontSize: 12, fontWeight: 600 }}>Compliance:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {selectedProduct.compliance_tags.map((tag, index) => (
                          <span key={index} style={{
                            background: '#fff3e0',
                            color: '#f57c00',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedProduct.features && selectedProduct.features.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ margin: '0 0 4px 0', color: '#ccc', fontSize: 12, fontWeight: 600 }}>Features:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {selectedProduct.features.map((feature, index) => (
                          <span key={index} style={{
                            background: '#f3e5f5',
                            color: '#7b1fa2',
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500
                          }}>
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <h3 style={{ marginBottom: 16, color: 'white' }}>Order Details</h3>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'white' }}>
                  Quantity:
                  <input
                    type="number"
                    value={orderQty}
                    onChange={e => setOrderQty(Number(e.target.value))}
                    min="1"
                    style={{ width: 100, padding: '4px 8px', border: '1px solid #333', borderRadius: 4, background: '#222', color: 'white' }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'white' }}>
                  <input
                    type="checkbox"
                    checked={includeInstall}
                    onChange={e => setIncludeInstall(e.target.checked)}
                  />
                  Include Installation
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'white', position: 'relative' }}>
                  Delivery Address:
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={e => {
                      setDeliveryAddress(e.target.value);
                      getAddressSuggestions(e.target.value);
                      // Calculate distance when address changes
                      if (e.target.value.trim()) {
                        calculateDeliveryDistance(e.target.value);
                      } else {
                        setDeliveryDistance(null);
                        setDistanceLoading(false);
                      }
                    }}
                    placeholder="Enter delivery address"
                    style={{ width: 300, padding: '4px 8px', border: '1px solid #333', borderRadius: 4, background: '#222', color: 'white' }}
                  />
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#222', border: '1px solid #333', borderRadius: 4, zIndex: 1000, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>
                      {addressSuggestions.map(suggestion => (
                        <div
                          key={suggestion.id}
                          onClick={() => handleAddressSelect(suggestion)}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #333', color: 'white', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#333'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          {suggestion.text}
                        </div>
                      ))}
                    </div>
                  )}
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'white' }}>
                  Your Proposed Price (optional):
                  <input
                    type="number"
                    value={proposedPrice}
                    onChange={e => setProposedPrice(e.target.value)}
                    min="1"
                    placeholder={priceBreakdown ? `Suggested: ₹${priceBreakdown.product_base_price}` : 'Enter your price'}
                    style={{ width: 200, padding: '4px 8px', border: '1px solid #333', borderRadius: 4, background: '#222', color: 'white' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'white' }}>
                  Proposed Deadline:
                  <input
                    type="datetime-local"
                    value={proposedDeadline} 
                    onChange={e => setProposedDeadline(e.target.value)}
                    required
                    style={{ width: 200, background: '#222', color: 'white', border: '1px solid #333', borderRadius: 4, padding: '4px 8px' }} 
                  />
                </label>
                <button onClick={handlePriceBreakdown} disabled={loading} style={{ background: '#457b9d', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 500 }}>Update Price</button>
              </div>
            </div>
          )}
          {priceBreakdown && (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, background: '#111', borderRadius: 6, color: 'white' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #333' }}><td style={{ padding: '8px', borderRight: '1px solid #333' }}>Base Price</td><td style={{ padding: '8px' }}>₹{priceBreakdown.product_base_price}</td></tr>
                <tr style={{ borderBottom: '1px solid #333' }}><td style={{ padding: '8px', borderRight: '1px solid #333' }}>Customization Fee</td><td style={{ padding: '8px' }}>₹{priceBreakdown.customization_fee}</td></tr>
                <tr style={{ borderBottom: '1px solid #333' }}><td style={{ padding: '8px', borderRight: '1px solid #333' }}>Installation Charge</td><td style={{ padding: '8px' }}>₹{priceBreakdown.installation_charge}</td></tr>
                <tr style={{ borderBottom: '1px solid #333' }}><td style={{ padding: '8px', borderRight: '1px solid #333' }}>Tax (18%)</td><td style={{ padding: '8px' }}>₹{priceBreakdown.tax_amount}</td></tr>
                <tr style={{ borderBottom: '1px solid #333' }}><td style={{ padding: '8px', borderRight: '1px solid #333' }}>Delivery Fee</td><td style={{ padding: '8px' }}>₹{priceBreakdown.delivery_fee}</td></tr>
                <tr style={{ borderBottom: '1px solid #333' }}><td style={{ padding: '8px', borderRight: '1px solid #333', fontWeight: 'bold' }}>Total Price</td><td style={{ padding: '8px', fontWeight: 'bold' }}>₹{priceBreakdown.total_price}</td></tr>
                <tr><td colSpan={2} style={{ padding: '8px', fontStyle: 'italic', color: '#ccc' }}>{priceBreakdown.note}</td></tr>
              </tbody>
            </table>
              {includeInstall && (
                <div style={{ fontSize: '12px', color: '#ccc', marginTop: '8px', padding: '8px', background: '#111', borderRadius: '4px', border: '1px solid #333' }}>
                  <strong>Installation Charge Rates:</strong><br/>
                  • Orders under ₹80,000: 10%<br/>
                  • Orders ₹80,000 - ₹170,000: 5%<br/>
                  • Orders over ₹170,000: 4%
                </div>
              )}
              {deliveryAddress && (
                <div style={{ fontSize: '12px', color: '#ccc', marginTop: '8px', padding: '8px', background: '#111', borderRadius: '4px', border: '1px solid #333' }}>
                  <strong>Transportation Cost:</strong><br/>
                  • Calculated using AI-trained truck cost model<br/>
                  • Based on distance from Pune warehouse<br/>
                  • Supports major Indian cities (Mumbai, Delhi, Bangalore, etc.)
                  {distanceLoading && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#222', borderRadius: '4px', border: '1px solid #333', textAlign: 'center', color: '#ccc' }}>
                      🔄 Calculating distance and delivery cost...
                    </div>
                  )}
                  {deliveryDistance && !distanceLoading && deliveryDistance.delivery_coordinates && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#222', borderRadius: '4px', border: '1px solid #333', color: '#ccc' }}>
                      <strong>Distance Details:</strong><br/>
                      • From: Pune Warehouse (18.5204°N, 73.8567°E)<br/>
                      • To: {deliveryDistance.geocoded_address}<br/>
                      • Distance: {deliveryDistance.distance_km} km<br/>
                      • Coordinates: {deliveryDistance.delivery_coordinates.lat.toFixed(4)}°N, {deliveryDistance.delivery_coordinates.lng.toFixed(4)}°E
                    </div>
                  )}
                  {deliveryDistance && !distanceLoading && !deliveryDistance.delivery_coordinates && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#222', borderRadius: '4px', border: '1px solid #333', color: '#ccc' }}>
                      <strong>Distance Details:</strong><br/>
                      • From: Pune Warehouse (18.5204°N, 73.8567°E)<br/>
                      • To: {deliveryDistance.geocoded_address}<br/>
                      • Distance: {deliveryDistance.distance_km} km<br/>
                      • Note: Coordinates not available
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <button onClick={handlePlaceOrder} disabled={loading || !priceBreakdown} style={{ background: '#38b000', color: 'white', border: 'none', borderRadius: 4, padding: '8px 18px', fontWeight: 600, fontSize: 16 }}>Place Request</button>
          {orderStatus && <div style={{ color: 'green', marginTop: 8 }}>{orderStatus}</div>}
          {orderError && <div style={{ color: 'red', marginTop: 8 }}>{orderError}</div>}
        </div>
      )}

      {activeTab === 'pending-requests' && (
        <div>
          <h2 style={{marginBottom: 12, color: 'white'}}>Pending Requests</h2>
          <p style={{ color: '#ccc', marginBottom: 24, fontSize: 16 }}>
            Requests that are under review or have received quotes waiting for your response.
          </p>
          {getPendingRequests().length === 0 ? (
            <div style={{ color: '#ccc', marginBottom: 16, textAlign: 'center', padding: '40px 20px', background: '#111', borderRadius: 8, border: '1px solid #333' }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>📋 No pending requests</div>
              <div>Place a request to see it here!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {getPendingRequests().map(request => (
                <div key={request.id} style={{
                  background: '#000',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  padding: 24,
                  minWidth: 320,
                  maxWidth: 360,
                  flex: '1 1 320px',
                  display: 'flex',
                  flexDirection: 'column',
                  marginBottom: 16,
                  border: request.status === 'quoted' ? '2px solid #007bff' : '2px solid #f59e42'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#fff' }}>Request #{request.id}</div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ 
                      background: getStatusBadgeColor(request.status), 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: 12, 
                      fontSize: 12, 
                      fontWeight: 600 
                    }}>
                      {getStatusDisplayText(request.status).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Product:</b> {request.product_name || 'N/A'}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Quantity:</b> {request.quantity}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Expected Delivery:</b> {request.expected_delivery ? request.expected_delivery.slice(0, 10) : 'Not specified'}</div>
                  {request.quoted_price && (
                    <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Quoted Price:</b> ₹{request.quoted_price}</div>
                  )}
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Manager:</b> {request.manager_name || 'Not assigned'}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Notes:</b> {request.notes || 'No notes'}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button 
                      onClick={() => handleViewDetails(request)}
                      style={{ background: '#457b9d', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}
                    >
                      View Details
                    </button>
                    {request.status === 'quoted' && (
                      <button 
                        onClick={() => handleViewQuote(request)}
                        style={{ background: '#007bff', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}
                      >
                        Respond to Quote
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'responded-requests' && (
        <div>
          <h2 style={{marginBottom: 12, color: '#1d3557'}}>Responded Requests</h2>
          <p style={{ color: '#666', marginBottom: 24, fontSize: 16 }}>
            Requests where you have accepted or declined the quote.
          </p>
          {getRespondedRequests().length === 0 ? (
            <div style={{ color: '#888', marginBottom: 16, textAlign: 'center', padding: '40px 20px', background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>📋 No responded requests</div>
              <div>Respond to quotes to see them here!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {getRespondedRequests().map(request => (
                <div key={request.id} style={{
                  background: '#000',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  padding: 24,
                  minWidth: 320,
                  maxWidth: 360,
                  flex: '1 1 320px',
                  display: 'flex',
                  flexDirection: 'column',
                  marginBottom: 16,
                  border: request.status === 'customer_accepted' ? '2px solid #28a745' : '2px solid #e74c3c'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#fff' }}>Request #{request.id}</div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ 
                      background: getStatusBadgeColor(request.status), 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: 12, 
                      fontSize: 12, 
                      fontWeight: 600 
                    }}>
                      {getStatusDisplayText(request.status).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Product:</b> {request.product_name || 'N/A'}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Quantity:</b> {request.quantity}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Quoted Price:</b> ₹{request.quoted_price || 'N/A'}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Your Response:</b> {request.customer_response}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Notes:</b> {request.notes || 'No notes'}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button 
                      onClick={() => handleViewDetails(request)}
                      style={{ background: '#457b9d', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}
                    >
                      View Details
                    </button>
                    {request.status === 'customer_accepted' && (
                      <button 
                        onClick={() => handleDownloadInvoice(request)}
                        style={{ background: '#f59e42', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}
                      >
                        Download Invoice
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'completed-requests' && (
        <div>
          <h2 style={{marginBottom: 12, color: '#1d3557'}}>Completed Requests</h2>
          <p style={{ color: '#666', marginBottom: 24, fontSize: 16 }}>
            Requests that are in transit or have been completed.
          </p>
          {getCompletedRequests().length === 0 ? (
            <div style={{ color: '#888', marginBottom: 16, textAlign: 'center', padding: '40px 20px', background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>📋 No completed requests</div>
              <div>Accepted requests will appear here once processing begins!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
              {getCompletedRequests().map(request => (
                <div key={request.id} style={{
                  background: '#000',
                  borderRadius: 12,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  padding: 24,
                  minWidth: 320,
                  maxWidth: 360,
                  flex: '1 1 320px',
                  display: 'flex',
                  flexDirection: 'column',
                  marginBottom: 16,
                  border: '2px solid #28a745'
                }}>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#fff' }}>Request #{request.id}</div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ 
                      background: getStatusBadgeColor(request.status), 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: 12, 
                      fontSize: 12, 
                      fontWeight: 600 
                    }}>
                      {getStatusDisplayText(request.status).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Product:</b> {request.product_name || 'N/A'}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Quantity:</b> {request.quantity}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Quoted Price:</b> ₹{request.quoted_price || 'N/A'}</div>
                  <div style={{ marginBottom: 6, color: '#ccc' }}><b style={{ color: '#fff' }}>Notes:</b> {request.notes || 'No notes'}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button 
                      onClick={() => handleViewDetails(request)}
                      style={{ background: '#457b9d', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => handleDownloadInvoice(request)}
                      style={{ background: '#f59e42', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600 }}
                    >
                      Download Invoice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quote Response Modal */}
      {showQuoteModal && selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ marginBottom: 16, color: '#1d3557' }}>Respond to Quote</h2>
            <div style={{ marginBottom: 16 }}>
              <p><strong>Request #:</strong> {selectedRequest.id}</p>
              <p><strong>Product:</strong> {selectedRequest.product_name}</p>
              <p><strong>Quantity:</strong> {selectedRequest.quantity}</p>
              <p><strong>Quoted Price:</strong> ₹{selectedRequest.quoted_price}</p>
              <p><strong>Manager:</strong> {selectedRequest.manager_name}</p>
              <p><strong>Notes:</strong> {selectedRequest.notes || 'No additional notes'}</p>
            </div>
            {/* Negotiation History */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ color: '#457b9d', marginBottom: 8 }}>Negotiation History</h4>
              {negotiationHistory.length === 0 ? (
                <div style={{ color: '#888', fontSize: 13 }}>No negotiation rounds yet.</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {negotiationHistory.map((n, idx) => (
                    <li key={n.id} style={{ marginBottom: 8, background: '#f8f9fa', borderRadius: 6, padding: 8 }}>
                      <div style={{ fontWeight: 600, color: n.offer_type === 'admin_counter' ? '#e67e22' : '#1976d2' }}>
                        {n.offer_type === 'admin_counter' ? 'Admin Counter-Offer' : 'Customer Offer'}
                        {n.status === 'accepted' && <span style={{ color: '#28a745', marginLeft: 8 }}>(Accepted)</span>}
                        {n.status === 'rejected' && <span style={{ color: '#e74c3c', marginLeft: 8 }}>(Rejected)</span>}
                        {n.status === 'pending' && <span style={{ color: '#f59e42', marginLeft: 8 }}>(Pending)</span>}
                      </div>
                      <div>Amount: <b>₹{n.total_amount}</b></div>
                      <div style={{ fontSize: 12, color: '#555' }}>{n.notes}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{new Date(n.created_at).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Counter-offer UI */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ color: '#457b9d', marginBottom: 8 }}>Propose Counter-Offer</h4>
              <input
                type="number"
                placeholder="Enter your counter-offer amount"
                value={counterOfferAmount}
                onChange={e => setCounterOfferAmount(e.target.value)}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}
              />
              <textarea
                placeholder="Add notes for your counter-offer (optional)"
                value={counterOfferNotes}
                onChange={e => setCounterOfferNotes(e.target.value)}
                style={{ width: '100%', minHeight: 60, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
              />
              <button
                onClick={handleCounterOffer}
                disabled={counterOfferLoading}
                style={{ background: '#007bff', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, marginTop: 8 }}
              >
                {counterOfferLoading ? 'Submitting...' : 'Submit Counter-Offer'}
              </button>
            </div>
            {/* Existing notes and actions */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Additional Notes (Optional):
              </label>
              <textarea
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                placeholder="Add any comments, questions, or revision requests..."
                style={{
                  width: '100%',
                  minHeight: 100,
                  padding: 12,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowQuoteModal(false)}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleQuoteResponse(selectedRequest.id, 'revise', revisionNotes)}
                disabled={responseLoading}
                style={{
                  background: '#f59e42',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {responseLoading ? 'Requesting Revision...' : 'Request Revision'}
              </button>
              <button
                onClick={() => handleQuoteResponse(selectedRequest.id, 'declined', revisionNotes)}
                disabled={responseLoading}
                style={{
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {responseLoading ? 'Declining...' : 'Decline Quote'}
              </button>
              <button
                onClick={() => handleQuoteResponse(selectedRequest.id, 'accepted', revisionNotes)}
                disabled={responseLoading}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  padding: '8px 16px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {responseLoading ? 'Accepting...' : 'Accept Quote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsModal.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 32, maxWidth: 500, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: 16, color: '#1d3557' }}>Request Details</h2>
            <div style={{ marginBottom: 16 }}>
              <p><strong>Request #:</strong> {detailsModal.request.id}</p>
              <p><strong>Product:</strong> {detailsModal.request.product_name}</p>
              <p><strong>Quantity:</strong> {detailsModal.request.quantity}</p>
              <p><strong>Delivery Address:</strong> {detailsModal.request.delivery_address || 'N/A'}</p>
              <p><strong>Status:</strong> {getStatusDisplayText(detailsModal.request.status)}</p>
            </div>
            {detailsModal.loading ? (
              <div>Loading distance and cost breakdown...</div>
            ) : detailsModal.error ? (
              <div style={{ color: 'red' }}>{detailsModal.error}</div>
            ) : (
              <>
                {detailsModal.price && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8, background: '#000', borderRadius: 6 }}>
                    <tbody>
                      <tr><td>Base Price</td><td>₹{detailsModal.price.product_base_price}</td></tr>
                      <tr><td>Customization Fee</td><td>₹{detailsModal.price.customization_fee}</td></tr>
                      <tr><td>Installation Charge</td><td>₹{detailsModal.price.installation_charge}</td></tr>
                      <tr><td>Tax (18%)</td><td>₹{detailsModal.price.tax_amount}</td></tr>
                      <tr><td>Delivery Fee</td><td>₹{detailsModal.price.delivery_fee}</td></tr>
                      <tr><td><b>Total Price</b></td><td><b>₹{detailsModal.price.total_price}</b></td></tr>
                      <tr><td colSpan={2}><i>{detailsModal.price.note}</i></td></tr>
                    </tbody>
                  </table>
                )}
                {detailsModal.distance && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', padding: '8px', background: '#e8f4fd', borderRadius: '4px' }}>
                    <strong>Distance Details:</strong><br/>
                    • From: Pune Warehouse (18.5204°N, 73.8567°E)<br/>
                    • To: {detailsModal.distance.geocoded_address}<br/>
                    • Distance: {detailsModal.distance.distance_km} km<br/>
                    • Coordinates: {detailsModal.distance.delivery_coordinates.lat.toFixed(4)}°N, {detailsModal.distance.delivery_coordinates.lng.toFixed(4)}°E
                  </div>
                )}
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setDetailsModal({ open: false, request: null, loading: false, error: '', distance: null, price: null })} style={{ background: '#6c757d', color: 'white', border: 'none', borderRadius: 4, padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerRequests; 