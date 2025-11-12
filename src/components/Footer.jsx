import React from 'react';
import '../components/Footer.css';

import paymaya from '../assets/paymaya.png';
import gcash from '../assets/gcash.png';
import facebook from '../assets/facebook.png';
import instagram from '../assets/instagram.png';
import tiktok from '../assets/tiktok.png';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-row">
        {/* Company Info Section */}
        <div className="footer-section company-info">
          <h4>OLD GOODS THRIFT</h4>
          <p>Your trusted partner in sustainable fashion. Quality pre-loved items at affordable prices.</p>
          <div className="contact-info">
            <p>📧 oldgoodsthrift@gmail.com</p>
            <p>📞 0909 940 9746</p>
            <p>📍 Marilao, Bulacan</p>
          </div>
        </div>

        {/* Store Info Section */}
        <div className="footer-section store-info">
          <h4>STORE INFO</h4>
          <div className="store-details">
            <p>🕒 Mon-Sat: 9AM-6PM</p>
            <p>🚚 Nationwide Shipping</p>
            <p>♻️ Sustainable Fashion</p>
          </div>
        </div>
      </div>

      {/* Payment & Social Section */}
      <div className="footer-row">
        <div className="footer-section left-section">
          <h4>PAYMENT METHODS</h4>
          <div className="payment-methods">
            <div className="payment-method-item">
              <img src={paymaya} alt="PayMaya" className="payment-icon" />
            </div>
            <div className="payment-method-item">
              <img src={gcash} alt="GCash" className="payment-icon" />
            </div>
          </div>
        </div>
        
        <div className="footer-section right-section">
          <h4>FOLLOW US</h4>
          <div className="social-links">
            <a href="https://www.facebook.com/oldgoodsthrift" target="_blank" rel="noopener noreferrer">
              <img src={facebook} alt="Facebook" className="social-icon" />
            </a>
            <a href="https://www.instagram.com/oldgoodsthrift.ph/" target="_blank" rel="noopener noreferrer">
              <img src={instagram} alt="Instagram" className="social-icon" />
            </a>
            <a href="https://www.tiktok.com/@oldgoodsthrift_23" target="_blank" rel="noopener noreferrer">
              <img src={tiktok} alt="Tiktok" className="social-icon" />
            </a>
          </div>
        </div>
      </div>

      {/* Copyright Section */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>&copy; 2025 Old Goods Thrift. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;