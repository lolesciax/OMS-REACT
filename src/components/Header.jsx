import React, { useState } from 'react';
import '../styles/SignUp.css';

const Header = ({ title = "Sign Up" }) => {
  const [showHelpModal, setShowHelpModal] = useState(false);

  const toggleHelpModal = () => {
    setShowHelpModal(!showHelpModal);
  };

  return (
    <>
      <header className="header">
        <div className="logo">
          <img src="/Shop Icon.jpg" alt="Shop Logo" />
          <h2>Old Goods Thrift <span>{title}</span></h2>
        </div>
        <a href="#" className="help-link" onClick={(e) => { e.preventDefault(); toggleHelpModal(); }}>
          Need help?
        </a>
      </header>

      {showHelpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Customer Support Center</h3>
              <button 
                className="close-modal-btn"
                onClick={toggleHelpModal}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="help-section">
                <h4>🛍️ Shopping Assistance</h4>
                
                <div className="help-item">
                  <h5>🔐 Account & Login Help</h5>
                  <p><strong>Forgot Password?</strong> Use our secure password reset above. You'll need both your username and registered email.</p>
                  <p><strong>New Customer?</strong> Sign up takes less than 2 minutes!</p>
                </div>

                <div className="help-item">
                  <h5>💳 Payment Methods</h5>
                  <p>We accept: <strong>GCash, PayMaya</strong></p>
                </div>
              </div>

              <div className="contact-section">
                <h4>📞 Customer Care Hotline</h4>
                <div className="contact-grid">
                  <div className="contact-item">
                    <strong>📧 Email Support</strong>
                    <p>support@oldgoodsthrift.com</p>
                  </div>
                  <div className="contact-item">
                    <strong>📱 SMS/Text</strong>
                    <p>0917-123-4567</p>
                    <small>For quick order inquiries</small>
                  </div>
                </div>
                <div className="business-hours">
                  <strong>🏪 Business Hours:</strong>
                  <p>Monday - Sunday: 7:00 AM - 12:00 MN</p>
                  <p>24/7 Online Ordering Available</p>
                </div>
              </div>

              <div className="technical-tips">
                <h4>🔧 Quick Troubleshooting</h4>
                <div className="tips-grid">
                  <div className="tip-item">
                    <strong>🖼️ Images Not Loading?</strong>
                    <p>Refresh page or check internet connection. Our image servers are not fully optimized yet.</p>
                  </div>
                </div>
              </div>

              <div className="promo-section">
                <h4>🎁 Special Offers</h4>
                <div className="promo-banner">
                  <p><strong>COMING SOON.</strong></p>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={toggleHelpModal}
                >
                  Close Help Center
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;