import React from 'react';
import './AdminFooter.css';

const AdminFooter = () => {
  return (
    <footer className="admin-footer">
      <div className="admin-footer-bottom-row">
        <div className="admin-footer-section">
          <div className="admin-system-info">
            <p>Admin Panel v1.0.0</p>
          </div>
        </div>
        
        <div className="admin-footer-section">
          <div className="admin-copyright">
            &copy; 2025 Old Goods Thrift @ All Rights Reserved.
          </div>
        </div>
        
        <div className="admin-footer-section">
          <div className="admin-status">
            <p>Status: Operational</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AdminFooter;