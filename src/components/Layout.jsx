import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

const Layout = ({ children }) => {
  const location = useLocation();

  return (
    <div className="dashboard">
      {/* FIXED HEADER */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <img src="/Shop Icon.jpg" alt="Logo" />
            <h2>Old Goods Thrift</h2>
          </div>
        </div>
        <div className="header-right">
          {location.pathname !== '/dashboard' && (
            <Link to="/dashboard" className="help-link">← Back to Dashboard</Link>
          )}
          <Link to="/" className="help-link">Logout</Link>
        </div>
      </header>

      <main className="dashboard-main">
        {/* FIXED SIDEBAR */}
        <aside className="dashboard-sidebar">
          <h3>Welcome!</h3>
          <ul>
            <li>
              <Link 
                to="/dashboard" 
                className={location.pathname === '/dashboard' ? 'active' : ''}
              >
                📋 Dashboard
              </Link>
            </li>
            <li>
              <Link 
                to="/products" 
                className={location.pathname === '/products' ? 'active' : ''}
              >
                👕 Add Product
              </Link>
            </li>
            <li>
              <Link 
                to="/orders" 
                className={location.pathname === '/orders' ? 'active' : ''}
              >
                📦 Orders Status
              </Link>
            </li>
            <li>
              <Link 
                to="/customers" 
                className={location.pathname === '/customers' ? 'active' : ''}
              >
                🧑 Customers
              </Link>
            </li>
            <li>
              <Link 
                to="/discounts" 
                className={location.pathname === '/discounts' ? 'active' : ''}
              >
                🔖 Discounts
              </Link>
            </li>
            <li>
              <Link 
                to="/view-orders" 
                className={location.pathname === '/view-orders' ? 'active' : ''}
              >
                📨 View Orders
              </Link>
            </li>
          </ul>
        </aside>

        {/* MAIN CONTENT */}
        <section className="dashboard-content">
          {children}
        </section>
      </main>

      <footer className="footer">
        <p>© 2025 Old Goods Thrift — Admin Dashboard</p>
      </footer>
    </div>
  );
};

export default Layout;