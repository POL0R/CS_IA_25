import React, { useState, useEffect } from "react";
import "./Reports.css";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import Papa from 'papaparse';
import { saveAs } from 'file-saver';

// Add forced Tailwind style for advanced report boxes
if (typeof document !== 'undefined' && !document.getElementById('box-advanced-report-style')) {
  const style = document.createElement('style');
  style.id = 'box-advanced-report-style';
  style.innerHTML = `
    .box-advanced-report {
      box-shadow: 0 8px 32px rgba(0,0,0,0.12) !important;
      background: #fff !important;
      border-radius: 1rem !important;
      border: 1px solid #e5e7eb !important;
      margin-bottom: 2.5rem !important;
    }
    .box-advanced-report .p-5 {
      padding: 2rem !important;
    }
    .box-advanced-report .rounded-t-xl {
      border-top-left-radius: 1rem !important;
      border-top-right-radius: 1rem !important;
    }
  `;
  document.head.appendChild(style);
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState("overview");
  const [dateRange, setDateRange] = useState("last_30_days");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const itemsPerPage = 20;
  // Centralized selection state
  const [selectedProduct, setSelectedProduct] = useState(null);

  // State for backend data
  const [kpis, setKpis] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  function getDateRangeValues(range) {
    const now = new Date();
    let start, end;
    switch (range) {
      case 'last_7_days':
        end = now;
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last_30_days':
        end = now;
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_90_days':
        end = now;
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      default:
        start = null;
        end = null;
    }
    return {
      start_date: start ? start.toISOString().split('T')[0] : undefined,
      end_date: end ? end.toISOString().split('T')[0] : undefined
    };
  }

  useEffect(() => {
    async function fetchAllReports() {
      setError('');
      setLoading(true);
      const { start_date, end_date } = getDateRangeValues(dateRange);
      let params = '';
      if (start_date && end_date) {
        params = `?start_date=${start_date}&end_date=${end_date}`;
      }
      try {
        const [k, i, t, a] = await Promise.all([
          fetch(`http://localhost:5001/reports/kpis`).then(res => res.json()),
          fetch(`http://localhost:5001/reports/inventory${params}`).then(res => res.json()),
          fetch(`http://localhost:5001/reports/transactions${params}`).then(res => res.json()),
          fetch(`http://localhost:5001/reports/analytics${params}`).then(res => res.json()),
        ]);
        setKpis(k);
        setInventory(i);
        setTransactions(t);
        setAnalytics(a);
      } catch (err) {
        setError('Failed to load reports. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    fetchAllReports();
  }, [dateRange]);

  const paginatedInventory = inventory.slice((inventoryPage-1)*itemsPerPage, inventoryPage*itemsPerPage);
  const paginatedTransactions = transactions.slice((transactionsPage-1)*itemsPerPage, transactionsPage*itemsPerPage);

  const generateCSV = (reportType) => {
    setIsGenerating(true);
    setTimeout(() => {
      let csvContent = "";
      switch (reportType) {
        case "inventory":
          csvContent = "Product Name,SKU,Category,Quantity,Unit Cost,Total Value,Supplier,Status\n";
          inventory.forEach(product => {
            csvContent += `${product.name},${product.sku},${product.category},${product.quantity},${product.cost},${(product.quantity * product.cost).toFixed(2)},${product.supplier},${product.status}\n`;
          });
          break;
        case "transactions":
          csvContent = "Date,Type,Product,SKU,Quantity,Unit,Cost per Unit,Total Cost,Location,User,Notes\n";
          transactions.forEach(transaction => {
            csvContent += `${transaction.date},${transaction.type},${transaction.product_name},${transaction.sku},${transaction.quantity},${transaction.unit},${transaction.cost_per_unit},${transaction.total_cost},${transaction.location},${transaction.user},${transaction.notes}\n`;
          });
          break;
        case "analytics":
          if (analytics) {
            csvContent = "Category,Stock Value\n";
            Object.entries(analytics.categoryData || {}).forEach(([cat, val]) => {
              csvContent += `${cat},${val}\n`;
            });
            csvContent += "\nSupplier,Stock Value\n";
            Object.entries(analytics.supplierData || {}).forEach(([sup, val]) => {
              csvContent += `${sup},${val}\n`;
            });
            csvContent += "\nStock Status,Count\n";
            Object.entries(analytics.stockStatus || {}).forEach(([status, count]) => {
              csvContent += `${status},${count}\n`;
            });
            csvContent += "\nTransaction Summary,Value\n";
            Object.entries(analytics.transactionSummary || {}).forEach(([k, v]) => {
              csvContent += `${k},${v}\n`;
            });
          }
          break;
      }
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setIsGenerating(false);
    }, 1000);
  };

  const generatePDF = (reportType) => {
    setIsGenerating(true);
    setTimeout(() => {
      const doc = new jsPDF();
      if (reportType === 'inventory') {
        doc.text('Inventory Report', 14, 16);
        doc.autoTable({
          head: [['Product Name','SKU','Category','Quantity','Unit Cost','Total Value','Supplier','Status']],
          body: inventory.map(product => [product.name, product.sku, product.category, product.quantity, product.cost, (product.quantity*product.cost).toFixed(2), product.supplier, product.status])
        });
      } else if (reportType === 'transactions') {
        doc.text('Transaction Report', 14, 16);
        doc.autoTable({
          head: [['Date','Type','Product','SKU','Quantity','Unit','Cost per Unit','Total Cost','Location','User','Notes']],
          body: transactions.map(t => [t.date, t.type, t.product_name, t.sku, t.quantity, t.unit, t.cost_per_unit, t.total_cost, t.location, t.user, t.notes])
        });
      } else if (reportType === 'analytics' && analytics) {
        doc.text('Analytics Report', 14, 16);
        // Add analytics summary as text or table
        doc.text(JSON.stringify(analytics, null, 2), 14, 30);
      }
      doc.save(`${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`);
      setIsGenerating(false);
    }, 1000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  function downloadCSVFromData(data, filename) {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, filename);
  }

  function Box({ title, children, color = 'blue' }) {
    const colorMap = {
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      red: 'bg-red-600',
      orange: 'bg-orange-500',
      purple: 'bg-purple-600',
      gray: 'bg-gray-700',
    };
    return (
      <div className="box-advanced-report mb-10">
        <div className={`rounded-t-xl px-5 py-3 text-white text-lg font-bold ${colorMap[color]}`} style={{backgroundColor: undefined}}>{title}</div>
        <div className="p-5">{children}</div>
      </div>
    );
  }

  function LowStockReport({ products, transactions, selectedProduct, setSelectedProduct }) {
    // Predictive reorder quantity based on last 7 days outflow
    const today = new Date();
    const last7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const rows = products.filter(p => p.quantity <= (p.reorder_level || 0)).map(p => {
      const txs = transactions.filter(t => t.product_id === p.id && t.type === 'stock_out' && new Date(t.date) >= last7);
      const total_out = txs.reduce((sum, t) => sum + t.quantity, 0);
      const avg_daily_usage = total_out / 7;
      const lead_time_days = 7;
      const suggested_reorder = Math.round(avg_daily_usage * lead_time_days);
      return {
        SKU: p.sku,
        Name: p.name,
        Category: p.category,
        Quantity: p.quantity,
        'Reorder Level': p.reorder_level,
        'Avg Daily Usage': avg_daily_usage.toFixed(2),
        'Suggested Reorder': suggested_reorder
      };
    });
    return (
      <Box title="Low Stock Report" color="red">
        <button className="bg-green-600 text-white px-3 py-1 rounded mb-2" onClick={() => downloadCSVFromData(rows, 'low_stock_report.csv')}>Download CSV</button>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr>{rows[0] && Object.keys(rows[0]).map(c => <th key={c} className="border px-2 py-1 bg-gray-100">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isSelected = selectedProduct && row.SKU === selectedProduct.sku;
                return (
                  <tr key={i} className={isSelected ? 'bg-blue-100 font-bold' : 'cursor-pointer hover:bg-blue-50'} onClick={() => {
                    const prod = products.find(p => p.sku === row.SKU);
                    setSelectedProduct(prod);
                  }}>
                    {Object.keys(row).map(c => <td key={c} className="border px-2 py-1">{row[c]}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="text-gray-500 mt-2">No low stock products.</div>}
        </div>
        {selectedProduct && <div className="mt-2 text-blue-700">Selected: {selectedProduct.name} ({selectedProduct.sku})</div>}
      </Box>
    );
  }

  function ReorderPredictionReport({ products, transactions, selectedProduct, setSelectedProduct }) {
    // Days until stockout using 30-day moving average, flag urgent
    const today = new Date();
    const last30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows = products.map(p => {
      const txs = transactions.filter(t => t.product_id === p.id && t.type === 'stock_out' && new Date(t.date) >= last30);
      const total_out = txs.reduce((sum, t) => sum + t.quantity, 0);
      const avg_daily_usage = total_out / 30;
      const days_until_stockout = avg_daily_usage ? p.quantity / avg_daily_usage : Infinity;
      const urgent = days_until_stockout <= 7;
      return {
        SKU: p.sku,
        Name: p.name,
        'Days Until Stockout': days_until_stockout === Infinity ? '∞' : days_until_stockout.toFixed(1),
        Recommendation: urgent ? 'Reorder now' : 'Monitor',
      };
    });
    return (
      <Box title="Reorder Prediction Report" color="orange">
        <button className="bg-green-600 text-white px-3 py-1 rounded mb-2" onClick={() => downloadCSVFromData(rows, 'reorder_prediction_report.csv')}>Download CSV</button>
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr>{rows[0] && Object.keys(rows[0]).map(c => <th key={c} className="border px-2 py-1 bg-gray-100">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isSelected = selectedProduct && row.SKU === selectedProduct.sku;
                return (
                  <tr key={i} className={isSelected ? 'bg-blue-100 font-bold' : 'cursor-pointer hover:bg-blue-50'} onClick={() => {
                    const prod = products.find(p => p.sku === row.SKU);
                    setSelectedProduct(prod);
                  }}>
                    {Object.keys(row).map(c => <td key={c} className="border px-2 py-1">{row[c]}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="text-gray-500 mt-2">No products to predict reorder for.</div>}
        </div>
        {selectedProduct && <div className="mt-2 text-blue-700">Selected: {selectedProduct.name} ({selectedProduct.sku})</div>}
      </Box>
    );
  }

  return (
    <div className="reports-container">
      {/* Header */}
      <div className="reports-header">
        <div className="header-left">
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Generate comprehensive reports, export data, and analyze inventory performance</p>
        </div>
        <div className="header-actions">
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="date-range-select"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="last_90_days">Last 90 Days</option>
            <option value="this_year">This Year</option>
          </select>
        </div>
      </div>

      {/* Report Navigation */}
      <div className="report-nav">
        <button 
          className={`nav-tab ${activeReport === "overview" ? "active" : ""}`}
          onClick={() => setActiveReport("overview")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
          </svg>
          Overview
        </button>
        <button 
          className={`nav-tab ${activeReport === "inventory" ? "active" : ""}`}
          onClick={() => setActiveReport("inventory")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          </svg>
          Inventory Report
        </button>
        <button 
          className={`nav-tab ${activeReport === "transactions" ? "active" : ""}`}
          onClick={() => setActiveReport("transactions")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Transaction Report
        </button>
        <button 
          className={`nav-tab ${activeReport === "analytics" ? "active" : ""}`}
          onClick={() => setActiveReport("analytics")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
          Analytics
        </button>
      </div>

      {/* Report Content */}
      <div className="report-content">
        {activeReport === "overview" && (
          <div className="overview-report">
            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <h3 className="kpi-value">{kpis?.totalProducts || 0}</h3>
                  <p className="kpi-label">Total Products</p>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <h3 className="kpi-value">{formatCurrency(kpis?.totalValue || 0)}</h3>
                  <p className="kpi-label">Total Stock Value</p>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon warning">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <h3 className="kpi-value">{kpis?.lowStockItems || 0}</h3>
                  <p className="kpi-label">Low Stock Items</p>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon danger">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <h3 className="kpi-value">{kpis?.outOfStockItems || 0}</h3>
                  <p className="kpi-label">Out of Stock</p>
                </div>
              </div>
            </div>

            {/* Export Actions */}
            <div className="export-section">
              <h3 className="section-title">Export Reports</h3>
              <div className="export-buttons">
                <button 
                  className="export-btn csv"
                  onClick={() => generateCSV("analytics")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                  Export Analytics CSV
                </button>
                <button 
                  className="export-btn pdf"
                  onClick={() => generatePDF("analytics")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
                  </svg>
                  Export Analytics PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {activeReport === "inventory" && (
          <div className="inventory-report">
            <div className="report-header">
              <h2>Inventory Report</h2>
              <div className="report-actions">
                <button 
                  className="export-btn csv"
                  onClick={() => generateCSV("inventory")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                  Export CSV
                </button>
                <button 
                  className="export-btn pdf"
                  onClick={() => generatePDF("inventory")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>

            <div className="report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Unit Cost</th>
                    <th>Total Value</th>
                    <th>Supplier</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInventory.map(product => (
                    <tr key={product.id}>
                      <td className="product-name">{product.name}</td>
                      <td className="product-sku">{product.sku}</td>
                      <td className="product-category">
                        <span className="category-badge">{product.category}</span>
                      </td>
                      <td className="product-quantity">{product.quantity}</td>
                      <td className="product-cost">{formatCurrency(product.cost)}</td>
                      <td className="product-value">{formatCurrency(product.quantity * product.cost)}</td>
                      <td className="product-supplier">{product.supplier}</td>
                      <td className="product-status">
                        <span className={`status-badge ${
                          product.quantity === 0 ? 'out_of_stock' :
                          product.quantity <= 10 ? 'low_stock' : 'in_stock'
                        }`}>
                          {product.quantity === 0 ? 'Out of Stock' :
                           product.quantity <= 10 ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {inventory.length > itemsPerPage && (
                <div className="pagination-controls">
                  <button onClick={() => setInventoryPage(prev => Math.max(1, prev - 1))} disabled={inventoryPage === 1}>Previous</button>
                  <span>Page {inventoryPage} of {Math.ceil(inventory.length / itemsPerPage)}</span>
                  <button onClick={() => setInventoryPage(prev => Math.min(Math.ceil(inventory.length / itemsPerPage), prev + 1))} disabled={inventoryPage === Math.ceil(inventory.length / itemsPerPage)}>Next</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeReport === "transactions" && (
          <div className="transactions-report">
            <div className="report-header">
              <h2>Transaction Report</h2>
              <div className="report-actions">
                <button 
                  className="export-btn csv"
                  onClick={() => generateCSV("transactions")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                  Export CSV
                </button>
                <button 
                  className="export-btn pdf"
                  onClick={() => generatePDF("transactions")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>

            <div className="report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Cost per Unit</th>
                    <th>Total Cost</th>
                    <th>Location</th>
                    <th>User</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td className="transaction-date">{transaction.date}</td>
                      <td className="transaction-type">
                        <span className={`type-badge ${transaction.type}`}>
                          {transaction.type === 'stock_in' ? 'Stock In' :
                           transaction.type === 'stock_out' ? 'Stock Out' : 'Transfer'}
                        </span>
                      </td>
                      <td className="transaction-product">{transaction.product_name}</td>
                      <td className="transaction-sku">{transaction.sku}</td>
                      <td className="transaction-quantity">{transaction.quantity}</td>
                      <td className="transaction-cost">{formatCurrency(transaction.cost_per_unit)}</td>
                      <td className="transaction-total-cost">{formatCurrency(transaction.total_cost)}</td>
                      <td className="transaction-location">{transaction.location}</td>
                      <td className="transaction-user">{transaction.user}</td>
                      <td className="transaction-notes">{transaction.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length > itemsPerPage && (
                <div className="pagination-controls">
                  <button onClick={() => setTransactionsPage(prev => Math.max(1, prev - 1))} disabled={transactionsPage === 1}>Previous</button>
                  <span>Page {transactionsPage} of {Math.ceil(transactions.length / itemsPerPage)}</span>
                  <button onClick={() => setTransactionsPage(prev => Math.min(Math.ceil(transactions.length / itemsPerPage), prev + 1))} disabled={transactionsPage === Math.ceil(transactions.length / itemsPerPage)}>Next</button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeReport === "analytics" && (
          <div className="analytics-report">
            <div className="analytics-grid">
              <div className="analytics-card">
                <h3>Stock Status Distribution</h3>
                <div className="analytics-list">
                  <div className="analytics-item">
                    <span className="item-label">In Stock</span>
                    <span className="item-value">{analytics?.stockStatus?.in_stock || 0}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="item-label">Low Stock</span>
                    <span className="item-value">{analytics?.stockStatus?.low_stock || 0}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="item-label">Out of Stock</span>
                    <span className="item-value">{analytics?.stockStatus?.out_of_stock || 0}</span>
                  </div>
                </div>
              </div>

              <div className="analytics-card">
                <h3>Transaction Summary</h3>
                <div className="analytics-list">
                  <div className="analytics-item">
                    <span className="item-label">Total Transactions</span>
                    <span className="item-value">{analytics?.transactionSummary?.total_transactions || 0}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="item-label">Stock In Value</span>
                    <span className="item-value">{formatCurrency(analytics?.transactionSummary?.stock_in_value || 0)}</span>
                  </div>
                  <div className="analytics-item">
                    <span className="item-label">Stock Out Value</span>
                    <span className="item-value">{formatCurrency(analytics?.transactionSummary?.stock_out_value || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="export-section">
              <h3 className="section-title">Export Analytics</h3>
              <div className="export-buttons">
                <button 
                  className="export-btn csv"
                  onClick={() => generateCSV("analytics")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                  Export Analytics CSV
                </button>
                <button 
                  className="export-btn pdf"
                  onClick={() => generatePDF("analytics")}
                  disabled={isGenerating}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/>
                  </svg>
                  Export Analytics PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Features */}
        <LowStockReport products={inventory} transactions={transactions} selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct} />
        <ReorderPredictionReport products={inventory} transactions={transactions} selectedProduct={selectedProduct} setSelectedProduct={setSelectedProduct} />

        {/* Loading Overlay */}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>Loading reports...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="error-overlay">
            <div className="error-message">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 