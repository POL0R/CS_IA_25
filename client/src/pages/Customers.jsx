import React, { useState, useEffect } from "react";
import "./Customers.css";

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = () => {
    fetch("http://localhost:5001/customers")
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(() => setCustomers([]));
  };

  const handleCreateCustomer = (customerData) => {
    fetch("http://localhost:5001/customers", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchCustomers();
        setShowCreateCustomer(false);
      } else {
        alert('Error: ' + (data.error || 'Failed to create customer'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleUpdateCustomer = (customerId, customerData) => {
    fetch(`http://localhost:5001/customers/${customerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customerData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchCustomers();
        setShowEditCustomer(false);
        setSelectedCustomer(null);
      } else {
        alert('Error: ' + (data.error || 'Failed to update customer'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setShowEditCustomer(true);
  };

  const filteredCustomers = customers.filter(customer => {
    return customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           customer.company.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="customers-container">
      {/* Header */}
      <div className="customers-header">
        <div className="header-left">
          <h1 className="page-title">Customer Management</h1>
          <p className="page-subtitle">Manage customer information, contact details, and credit limits</p>
        </div>
        <div className="header-actions">
          <button 
            className="action-btn create-customer"
            onClick={() => setShowCreateCustomer(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-section">
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            type="text"
            placeholder="Search customers by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Customers Grid */}
      <div className="customers-grid">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="customer-card">
            <div className="customer-header">
              <div className="customer-avatar">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="customer-info">
                <h3 className="customer-name">{customer.name}</h3>
                <p className="customer-company">{customer.company || 'No Company'}</p>
              </div>
              <button 
                className="btn-edit"
                onClick={() => handleEditCustomer(customer)}
                title="Edit Customer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
            </div>
            
            <div className="customer-details">
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{customer.email || 'No email'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Phone:</span>
                <span className="detail-value">{customer.phone || 'No phone'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tax ID:</span>
                <span className="detail-value">{customer.tax_id || 'No tax ID'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Credit Limit:</span>
                <span className="detail-value credit-limit">${customer.credit_limit.toFixed(2)}</span>
              </div>
              {customer.address && (
                <div className="detail-item full-width">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value">{customer.address}</span>
                </div>
              )}
            </div>
            
            <div className="customer-footer">
              <span className="created-date">
                Created: {formatDate(customer.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Customer Modal */}
      {showCreateCustomer && (
        <CustomerForm
          onSubmit={handleCreateCustomer}
          onCancel={() => setShowCreateCustomer(false)}
        />
      )}

      {/* Edit Customer Modal */}
      {showEditCustomer && selectedCustomer && (
        <CustomerForm
          customer={selectedCustomer}
          onSubmit={handleUpdateCustomer}
          onCancel={() => {
            setShowEditCustomer(false);
            setSelectedCustomer(null);
          }}
        />
      )}
    </div>
  );
}

function CustomerForm({ customer, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    company: customer?.company || '',
    tax_id: customer?.tax_id || '',
    credit_limit: customer?.credit_limit || 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a customer name');
      return;
    }
    
    if (customer) {
      onSubmit(customer.id, formData);
    } else {
      onSubmit(formData);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content customer-form">
        <div className="modal-header">
          <h2>{customer ? 'Edit Customer' : 'Add New Customer'}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-grid">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Customer name"
                />
              </div>
              
              <div className="form-group">
                <label>Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Company name"
                />
              </div>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="customer@example.com"
                />
              </div>
              
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1234567890"
                />
              </div>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Tax ID</label>
                <input
                  type="text"
                  name="tax_id"
                  value={formData.tax_id}
                  onChange={handleChange}
                  placeholder="Tax identification number"
                />
              </div>
              
              <div className="form-group">
                <label>Credit Limit</label>
                <input
                  type="number"
                  name="credit_limit"
                  value={formData.credit_limit}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Full address..."
                rows="3"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              {customer ? 'Update Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 