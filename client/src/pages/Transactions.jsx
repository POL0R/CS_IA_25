import React, { useState, useEffect } from "react";
import "./Transactions.css";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [showStockInForm, setShowStockInForm] = useState(false);
  const [showStockOutForm, setShowStockOutForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5001/finished_products")
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data.map(fp => ({ id: fp.id, name: fp.model_name })) : []))
      .catch(() => setProducts([]));
    fetch("http://localhost:5001/transactions")
      .then(res => res.json())
      .then(data => setTransactions(data))
      .catch(() => setTransactions([]));
  }, []);

  const generateBatchNumber = (productSku) => {
    const timestamp = Date.now().toString().slice(-6);
    return `${productSku}${timestamp}`;
  };

  const handleStockIn = (transactionData) => {
    fetch("http://localhost:5001/transactions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'stock_in',
        product_id: transactionData.product_id,
        quantity: transactionData.quantity,
        location: transactionData.location,
        notes: transactionData.notes
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Refresh data
        fetch("http://localhost:5001/products")
          .then(res => res.json())
          .then(data => setProducts(data))
          .catch(() => setProducts([]));
        fetch("http://localhost:5001/transactions")
          .then(res => res.json())
          .then(data => setTransactions(data))
          .catch(() => setTransactions([]));
        setShowStockInForm(false);
      } else {
        alert('Error: ' + (data.error || 'Failed to process transaction'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const handleStockOut = (transactionData) => {
    fetch("http://localhost:5001/transactions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'stock_out',
        product_id: transactionData.product_id,
        quantity: transactionData.quantity,
        location: transactionData.location,
        notes: transactionData.notes
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Refresh data
        fetch("http://localhost:5001/products")
          .then(res => res.json())
          .then(data => setProducts(data))
          .catch(() => setProducts([]));
        fetch("http://localhost:5001/transactions")
          .then(res => res.json())
          .then(data => setTransactions(data))
          .catch(() => setTransactions([]));
        setShowStockOutForm(false);
      } else {
        alert('Error: ' + (data.error || 'Failed to process transaction'));
      }
    })
    .catch(error => {
      alert('Error: ' + error.message);
    });
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.batch_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || transaction.type === filterType;
    
    let matchesDate = true;
    if (filterDate !== "all") {
      const transactionDate = new Date(transaction.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      switch (filterDate) {
        case "today":
          matchesDate = transactionDate.toDateString() === today.toDateString();
          break;
        case "yesterday":
          matchesDate = transactionDate.toDateString() === yesterday.toDateString();
          break;
        case "last_week":
          matchesDate = transactionDate >= lastWeek;
          break;
        case "last_month":
          matchesDate = transactionDate >= lastMonth;
          break;
      }
    }
    
    return matchesSearch && matchesType && matchesDate;
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

  const getTransactionIcon = (type) => {
    switch (type) {
      case "stock_in":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        );
      case "stock_out":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z"/>
          </svg>
        );
      case "transfer":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="transactions-container">
      {/* Header */}
      <div className="transactions-header">
        <div className="header-left">
          <h1 className="page-title">Transaction History</h1>
          <p className="page-subtitle">Track stock movements, manage inventory flow, and monitor FIFO operations</p>
        </div>
        <div className="header-actions">
          {/* Removed Stock In and Stock Out buttons as per user request */}
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
            placeholder="Search transactions, products, or batch numbers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="stock_in">Stock In</option>
            <option value="stock_out">Stock Out</option>
            <option value="transfer">Transfer</option>
          </select>
          
          <select 
            value={filterDate} 
            onChange={(e) => setFilterDate(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_week">Last 7 Days</option>
            <option value="last_month">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="transactions-table-container">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Product</th>
              <th>Batch</th>
              <th>Quantity</th>
              <th>Cost</th>
              <th>Location</th>
              <th>Date</th>
              <th>User</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(transaction => (
              <tr key={transaction.id} className="transaction-row">
                <td className="transaction-type">
                  <span className={`type-badge ${transaction.type}`}>
                    {getTransactionIcon(transaction.type)}
                    {transaction.type === 'stock_in' && 'Stock In'}
                    {transaction.type === 'stock_out' && 'Stock Out'}
                    {transaction.type === 'transfer' && 'Transfer'}
                  </span>
                </td>
                <td className="transaction-product">
                  <div className="product-info">
                    <div className="product-name">{transaction.product_name}</div>
                    <div className="product-sku">{transaction.sku}</div>
                  </div>
                </td>
                <td className="transaction-batch">
                  <span className="batch-number">{transaction.batch_number}</span>
                </td>
                <td className="transaction-quantity">
                  <span className="quantity-value">{transaction.quantity}</span>
                </td>
                <td className="transaction-cost">
                  <div className="cost-info">
                    <div className="cost-per-unit">${transaction.cost_per_unit}</div>
                    <div className="total-cost">${transaction.total_cost.toFixed(2)}</div>
                  </div>
                </td>
                <td className="transaction-location">
                  {transaction.type === 'transfer' ? (
                    <div className="transfer-locations">
                      <div className="from-location">From: {transaction.from_location}</div>
                      <div className="to-location">To: {transaction.to_location}</div>
                    </div>
                  ) : (
                    <span className="location">{transaction.location}</span>
                  )}
                </td>
                <td className="transaction-date">
                  {formatDate(transaction.date)}
                </td>
                <td className="transaction-user">
                  <span className="user-badge">{transaction.user}</span>
                </td>
                <td className="transaction-notes">
                  <span className="notes-text">{transaction.notes}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredTransactions.length === 0 && (
          <div className="no-transactions">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
            </svg>
            <h3>No transactions found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Stock In Modal */}
      {showStockInForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Stock In Transaction</h2>
              <button 
                className="close-btn"
                onClick={() => setShowStockInForm(false)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <StockInForm
              products={products}
              onSubmit={handleStockIn}
              onCancel={() => setShowStockInForm(false)}
            />
          </div>
        </div>
      )}

      {/* Stock Out Modal */}
      {showStockOutForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Stock Out Transaction</h2>
              <button 
                className="close-btn"
                onClick={() => setShowStockOutForm(false)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <StockOutForm
              products={products}
              onSubmit={handleStockOut}
              onCancel={() => setShowStockOutForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Stock In Form Component
function StockInForm({ products, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    product_id: "",
    product_sku: "",
    quantity: 0,
    cost_per_unit: 0,
    supplier: "",
    location: "Warehouse A",
    notes: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedProduct = products.find(p => p.id === parseInt(formData.product_id));
    const totalCost = formData.quantity * formData.cost_per_unit;
    
    onSubmit({
      ...formData,
      product_id: parseInt(formData.product_id),
      product_name: selectedProduct.name,
      sku: selectedProduct.sku,
      total_cost: totalCost
    });
  };

  const handleProductChange = (e) => {
    const productId = e.target.value;
    const selectedProduct = products.find(p => p.id === parseInt(productId));
    
    setFormData(prev => ({
      ...prev,
      product_id: productId,
      product_sku: selectedProduct ? selectedProduct.sku : "",
      cost_per_unit: selectedProduct ? selectedProduct.cost : 0
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'cost_per_unit' ? parseFloat(value) || 0 : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-grid">
        <div className="form-group">
          <label>Product *</label>
          <select name="product_id" value={formData.product_id} onChange={handleProductChange} required>
            <option value="">Select a product</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku}) - Current Stock: {product.quantity}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Quantity *</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            min="1"
            placeholder="0"
          />
        </div>
        
        <div className="form-group">
          <label>Cost per Unit *</label>
          <input
            type="number"
            name="cost_per_unit"
            value={formData.cost_per_unit}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </div>
        
        <div className="form-group">
          <label>Supplier *</label>
          <input
            type="text"
            name="supplier"
            value={formData.supplier}
            onChange={handleChange}
            required
            placeholder="Enter supplier name"
          />
        </div>
        
        <div className="form-group">
          <label>Location *</label>
          <select name="location" value={formData.location} onChange={handleChange} required>
            <option value="Warehouse A">Warehouse A</option>
            <option value="Warehouse B">Warehouse B</option>
            <option value="Warehouse C">Warehouse C</option>
          </select>
        </div>
        
        <div className="form-group full-width">
          <label>Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Add any additional notes..."
            rows="3"
          />
        </div>
      </div>
      
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="save-btn">
          Process Stock In
        </button>
      </div>
    </form>
  );
}

// Stock Out Form Component
function StockOutForm({ products, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    product_id: "",
    product_sku: "",
    quantity: 0,
    cost_per_unit: 0,
    customer: "",
    location: "Warehouse A",
    notes: ""
  });
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const selectedProduct = products.find(p => p.id === parseInt(formData.product_id));
    if (!selectedProduct || selectedProduct.quantity === 0) {
      setError("Cannot stock out: Product is out of stock.");
      return;
    }
    if (formData.quantity > selectedProduct.quantity) {
      setError(`Cannot stock out more than available stock (${selectedProduct.quantity}).`);
      return;
    }
    setError("");
    const totalCost = formData.quantity * formData.cost_per_unit;
    
    onSubmit({
      ...formData,
      product_id: parseInt(formData.product_id),
      product_name: selectedProduct.name,
      sku: selectedProduct.sku,
      total_cost: totalCost
    });
  };

  const handleProductChange = (e) => {
    const productId = e.target.value;
    const selectedProduct = products.find(p => p.id === parseInt(productId));
    
    setFormData(prev => ({
      ...prev,
      product_id: productId,
      product_sku: selectedProduct ? selectedProduct.sku : "",
      cost_per_unit: selectedProduct ? selectedProduct.cost : 0
    }));
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'cost_per_unit' ? parseFloat(value) || 0 : value
    }));
    setError("");
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-grid">
        <div className="form-group">
          <label>Product *</label>
          <select name="product_id" value={formData.product_id} onChange={handleProductChange} required>
            <option value="">Select a product</option>
            {products.map(product => (
              <option key={product.id} value={product.id} disabled={product.quantity === 0}>
                {product.name} ({product.sku}) - Available: {product.quantity} {product.quantity === 0 ? '(Out of Stock)' : ''}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Quantity *</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            required
            min="1"
            placeholder="0"
          />
        </div>
        
        <div className="form-group">
          <label>Cost per Unit *</label>
          <input
            type="number"
            name="cost_per_unit"
            value={formData.cost_per_unit}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            placeholder="0.00"
          />
        </div>
        
        <div className="form-group">
          <label>Customer *</label>
          <input
            type="text"
            name="customer"
            value={formData.customer}
            onChange={handleChange}
            required
            placeholder="Enter customer name"
          />
        </div>
        
        <div className="form-group">
          <label>Location *</label>
          <select name="location" value={formData.location} onChange={handleChange} required>
            <option value="Warehouse A">Warehouse A</option>
            <option value="Warehouse B">Warehouse B</option>
            <option value="Warehouse C">Warehouse C</option>
          </select>
        </div>
        
        <div className="form-group full-width">
          <label>Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Add any additional notes..."
            rows="3"
          />
        </div>
        {error && (
          <div className="form-error" style={{ color: 'red', marginTop: 8 }}>{error}</div>
        )}
      </div>
      
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="save-btn">
          Process Stock Out
        </button>
      </div>
    </form>
  );
} 