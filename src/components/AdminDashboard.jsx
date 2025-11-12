import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminFooter from './AdminFooter';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    productCount: 0,
    orderCount: 0,
    customerCount: 0,
    revenueAmount: 0
  });
  const [dashboardData, setDashboardData] = useState({
    recentOrders: [],
    lowStockProducts: [],
    topCustomers: [],
    orderStatusDistribution: [],
    recentCustomers: [],
    topSellingProducts: [],
    monthlyRevenue: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Interval ref to clear polling on unmount
  const intervalRef = useRef(null);

  useEffect(() => {
    checkAdminAccess();
    fetchDashboardStats();
    fetchDashboardData();

    // Poll every 5 seconds for real-time updates
    intervalRef.current = setInterval(() => {
      fetchDashboardStats();
      fetchDashboardData();
    }, 5000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  const checkAdminAccess = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.isAdmin) {
        navigate('/shopping');
      }
    } catch (err) {
      console.error('Error checking admin access:', err);
      navigate('/login');
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setError(null);
      const response = await fetch('http://localhost:5000/api/admin/stats');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load dashboard data. Please check if the backend server is running.');
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/dashboard-data');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDashboardData({
            recentOrders: data.recentOrders || [],
            lowStockProducts: data.lowStockProducts || [],
            topCustomers: data.topCustomers || [],
            orderStatusDistribution: data.orderStatusDistribution || [],
            recentCustomers: data.recentCustomers || [],
            topSellingProducts: data.topSellingProducts || [],
            monthlyRevenue: data.monthlyRevenue || []
          });
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Real chart data from API with null checks
  const revenueData = {
    labels: (dashboardData.monthlyRevenue || []).map(item => {
      const [year, month] = item._id.split('-');
      return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }),
    datasets: [
      {
        label: 'Revenue (₱)',
        data: (dashboardData.monthlyRevenue || []).map(item => item.revenue || 0),
        borderColor: '#ee4d2d',
        backgroundColor: 'rgba(238, 77, 45, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const revenueOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return '₱' + value.toLocaleString();
          },
        },
      },
    },
  };

  const productData = {
    labels: (dashboardData.topSellingProducts || []).map(item => item?._id || 'Unknown Product'),
    datasets: [
      {
        label: 'Units Sold',
        data: (dashboardData.topSellingProducts || []).map(item => item?.totalSold || 0),
        backgroundColor: '#ee4d2d',
      },
    ],
  };

  const productOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
    scales: { y: { beginAtZero: true } },
  };

  const statusData = {
    labels: (dashboardData.orderStatusDistribution || []).map(item => item?._id?.toUpperCase() || 'Unknown'),
    datasets: [
      {
        data: (dashboardData.orderStatusDistribution || []).map(item => item?.count || 0),
        backgroundColor: [
          '#ee4d2d',
          '#ff6b35',
          '#ff8c42',
          '#ffb142',
          '#ffda79',
        ],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: false,
      },
    },
    cutout: '60%',
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-container">
          <div className="loading-header">
            <div className="loading-logo">
              <div className="logo-spinner"></div>
              <h2>Old Goods Thrift</h2>
            </div>
            <p>Admin Dashboard</p>
          </div>
          
          <div className="loading-main">
            <div className="loading-spinner-container">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-center"></div>
            </div>
            
            <div className="loading-text">
              <h3>Loading Your Dashboard</h3>
              <p>Preparing analytics and insights...</p>
            </div>

            <div className="loading-stats-preview">
              <div className="stat-preview">
                <div className="stat-icon">🛍️</div>
                <div className="stat-loading"></div>
              </div>
              <div className="stat-preview">
                <div className="stat-icon">📦</div>
                <div className="stat-loading"></div>
              </div>
              <div className="stat-preview">
                <div className="stat-icon">👥</div>
                <div className="stat-loading"></div>
              </div>
              <div className="stat-preview">
                <div className="stat-icon">💸</div>
                <div className="stat-loading"></div>
              </div>
            </div>
          </div>

          <div className="loading-footer">
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* HEADER */}
      <header className="header">
        <div className="logo">
          <img src="/Shop Icon.jpg" alt="Logo" />
          <h2>Old Goods <span>Thrift</span></h2>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/shopping')} className="view-store-btn">
            🛍️ View Store
          </button>
          <button onClick={handleLogout} className="help-link">Logout</button>
        </div>
      </header>

      {/* MAIN */}
      <main className="dashboard-main">
        {/* SIDEBAR */}
        <aside className="dashboard-sidebar">
          <h3>Welcome!</h3>
          <ul>
            <li><button onClick={() => navigate('/admin/dashboard')} className="active">📋 Dashboard</button></li>
            <li><button onClick={() => navigate('/admin/products')}>👕 Manage Product</button></li>
            <li><button onClick={() => navigate('/admin/orders')}>📦 Orders Status</button></li>
            <li><button onClick={() => navigate('/admin/customers')}>🧑 Users</button></li>
            <li><button onClick={() => navigate('/admin/discounts')}>🔖 Discounts</button></li>
            <li><button onClick={() => navigate('/admin/view-orders')}>📨 View Orders</button></li>
          </ul>
        </aside>

        {/* DASHBOARD CONTENT */}
        <section className="dashboard-content">
          <h1>Dashboard Overview</h1>
          <p>Monitor your shop's performance and recent activity.</p>

          {error && (
            <div className="error-message" style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '20px',
              border: '1px solid #f5c6cb'
            }}>
              ⚠️ {error}
            </div>
          )}

          <div className="dashboard-cards">
            <div className="card">
              <h3>🛍️ Total Products</h3>
              <p id="productCount" style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0' }}>
                {stats.productCount}
              </p>
            </div>
            <div className="card">
              <h3>📦 Total Orders</h3>
              <p id="orderCount" style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0' }}>
                {stats.orderCount}
              </p>
              <small style={{color: '#666'}}>Confirmed & processed orders only</small>
            </div>
            <div className="card">
              <h3>👥 Customers</h3>
              <p id="customerCount" style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0' }}>
                {stats.customerCount}
              </p>
            </div>
            <div className="card">
              <h3>💸 Total Revenue</h3>
              <p id="revenueAmount" style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0' }}>
                ₱{stats.revenueAmount.toLocaleString()}
              </p>
              <small style={{color: '#666'}}>From completed orders</small>
            </div>
          </div>

          <div className="charts-container">
            <div className="chart-box">
              <h3>📈 Monthly Revenue Trend</h3>
              <div className="chart-wrapper">
                {dashboardData.monthlyRevenue && dashboardData.monthlyRevenue.length > 0 ? (
                  <Line data={revenueData} options={revenueOptions} />
                ) : (
                  <div className="chart-placeholder">
                    <p>No revenue data available</p>
                    <small>Complete some orders to see revenue trends</small>
                  </div>
                )}
              </div>
            </div>

            <div className="chart-box">
              <h3>🏆 Top Selling Products</h3>
              <div className="chart-wrapper">
                {dashboardData.topSellingProducts && dashboardData.topSellingProducts.length > 0 ? (
                  <Bar data={productData} options={productOptions} />
                ) : (
                  <div className="chart-placeholder">
                    <p>No product sales data</p>
                    <small>Products will appear here as they are sold</small>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NEW DASHBOARD SECTIONS */}
          <div className="dashboard-grid">
            
            {/* Recent Orders */}
            <div className="dashboard-section">
              <h3>📦 Recent Orders</h3>
              <div className="section-content no-scrollbar">
                {dashboardData.recentOrders && dashboardData.recentOrders.length > 0 ? (
                  dashboardData.recentOrders.map((order) => (
                    <div key={order._id} className="activity-item">
                      <div className="activity-info">
                        <p><strong>{order.customerName || 'Customer'}</strong> - ₱{order.total?.toLocaleString() || '0'}</p>
                        <small>Order #{order.orderNumber} • {formatDate(order.orderDate)}</small>
                        <div style={{ 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          backgroundColor: 
                            order.status === 'completed' ? '#d4edda' :
                            order.status === 'shipped' ? '#d1ecf1' :
                            order.status === 'processing' ? '#fff3cd' : 
                            order.status === 'confirmed' ? '#d1ecf1' : '#f8d7da',
                          color: 
                            order.status === 'completed' ? '#155724' :
                            order.status === 'shipped' ? '#0c5460' :
                            order.status === 'processing' ? '#856404' : 
                            order.status === 'confirmed' ? '#0c5460' : '#721c24',
                          display: 'inline-block',
                          marginTop: '4px'
                        }}>
                          {(order.status || 'pending').toUpperCase()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#666', textAlign: 'center' }}>No recent orders</p>
                )}
              </div>
            </div>

            {/* Low Stock Alert */}
            <div className="dashboard-section">
              <h3>⚠️ Low Stock Alert</h3>
              <div className="section-content no-scrollbar">
                {dashboardData.lowStockProducts && dashboardData.lowStockProducts.length > 0 ? (
                  dashboardData.lowStockProducts.map((product) => (
                    <div key={product._id} className="activity-item">
                      <div className="activity-info">
                        <p><strong>{product.name || 'Unnamed Product'}</strong></p>
                        <small>Only {product.stock || 0} left in stock • ₱{product.price?.toLocaleString() || '0'}</small>
                        <div style={{ 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem',
                          backgroundColor: (product.stock || 0) < 5 ? '#f8d7da' : '#fff3cd',
                          color: (product.stock || 0) < 5 ? '#721c24' : '#856404',
                          display: 'inline-block',
                          marginTop: '4px'
                        }}>
                          {(product.stock || 0) < 5 ? 'CRITICAL' : 'LOW'}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#666', textAlign: 'center' }}>All products are well stocked</p>
                )}
              </div>
            </div>

            {/* Top Customers */}
            <div className="dashboard-section">
              <h3>👑 Top Customers</h3>
              <div className="section-content no-scrollbar">
                {dashboardData.topCustomers && dashboardData.topCustomers.length > 0 ? (
                  dashboardData.topCustomers.map((customer, index) => (
                    <div key={customer.username} className="activity-item">
                      <div style={{ 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '50%', 
                        backgroundColor: '#ee4d2d', 
                        color: 'white', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        marginRight: '10px'
                      }}>
                        {index + 1}
                      </div>
                      <div className="activity-info">
                        <p><strong>{customer.name || customer.username || 'Customer'}</strong></p>
                        <small>₱{customer.totalSpent?.toLocaleString() || '0'} • {customer.orderCount || 0} orders</small>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#666', textAlign: 'center' }}>No customer data available</p>
                )}
              </div>
            </div>

            {/* Order Status Distribution */}
            <div className="dashboard-section">
              <h3>📊 Order Status</h3>
              <div className="section-content no-scrollbar">
                <div className="doughnut-chart-wrapper">
                  {dashboardData.orderStatusDistribution && dashboardData.orderStatusDistribution.length > 0 ? (
                    <Doughnut data={statusData} options={statusOptions} />
                  ) : (
                    <p style={{ color: '#666', textAlign: 'center' }}>No order data available</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <AdminFooter />
    </div>
  );
}

export default AdminDashboard;