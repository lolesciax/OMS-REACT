import React, { useState, useEffect } from 'react';
import '../styles/checkout.css';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';

const SHIPPING_FEE = 50.00;

function CheckoutPage() {
  const navigate = useNavigate();
  
  // 💾 State Hooks
  const [orderItems, setOrderItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [address, setAddress] = useState({
    recipient: '',
    contact: '',
    street: '',
    barangay: '',
    city: '',
    province: ''
  });
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [stockErrors, setStockErrors] = useState([]);
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [qrCode, setQrCode] = useState('');
  // NEW: Payment proof states
  const [showPaymentProofModal, setShowPaymentProofModal] = useState(false);
  const [proofImage, setProofImage] = useState(null);
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Helper function to ensure value is a number
  const ensureNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value) || 0;
    return 0;
  };

  // NEW: Generate random QR code
  const generateRandomQR = () => {
    const qrCodes = [
      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PAYMAYA_' + Math.random().toString(36).substring(7),
      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=GCASH_' + Math.random().toString(36).substring(7),
    ];
    return qrCodes[Math.floor(Math.random() * qrCodes.length)];
  };

  // NEW: Update cart quantity in database when changed in checkout
  // NOTE: Uses your backend: PUT /api/cart/<user_id>/update
  const updateCartQuantityInDatabase = async (productId, newQuantity) => {
    try {
      const userId = user?.id || user?.username;
      if (!userId) return false;

      const response = await fetch(`http://localhost:5000/api/cart/${userId}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: newQuantity
        }),
      });

      if (!response.ok) {
        console.warn('Failed to update cart quantity in database', await response.text());
        return false;
      } else {
        console.log('✅ Cart quantity updated in database');
        return true;
      }
    } catch (error) {
      console.error('Error updating cart quantity in database:', error);
      return false;
    }
  };

  // NEW: Remove item from database cart
  // NOTE: Uses your backend: DELETE /api/cart/<user_id>/remove with JSON body { product_id }
  const removeItemFromDatabase = async (itemId) => {
    try {
      const userId = user?.id || user?.username;
      if (!userId) return false;

      const response = await fetch(`http://localhost:5000/api/cart/${userId}/remove`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: itemId
        }),
      });

      if (!response.ok) {
        console.warn('Failed to remove item from database cart', await response.text());
        return false;
      } else {
        console.log('✅ Item removed from database cart');
        return true;
      }
    } catch (error) {
      console.error('Error removing item from database cart:', error);
      return false;
    }
  };

  // NEW: Reduce cart quantities after successful order
  // This uses GET /api/cart/<userId> which returns { success: true, cart: [...] }
  // and updates each cart item accordingly: update -> /api/cart/<userId>/update or remove -> /api/cart/<userId>/remove
  const reduceCartQuantitiesAfterOrder = async (orderedItems) => {
    try {
      const userId = user?.id || user?.username;
      if (!userId) return;

      // Fetch current cart from backend
      const cartResponse = await fetch(`http://localhost:5000/api/cart/${userId}`);
      if (!cartResponse.ok) {
        console.warn('Failed to fetch cart for reduction:', cartResponse.status);
        return;
      }

      const cartDataRaw = await cartResponse.json();
      // Your cart endpoint returns { success: true, cart: [ ... ] }
      const cartArray = Array.isArray(cartDataRaw.cart) ? cartDataRaw.cart : [];

      for (const orderedItem of orderedItems) {
        // orderedItem.id is the product id string from order
        // Find the matching cart item (backend returns items with product_id and id fields)
        const cartItem = cartArray.find(ci => {
          // support both shapes
          const ciId = ci.id || ci.product_id || ci.productId || ci.product_id;
          const ciProductId = ci.product_id || ci.productId || ci.id;
          return ciId === orderedItem.id || ciProductId === orderedItem.id || ci.id === orderedItem.id;
        });

        if (!cartItem) {
          // Not in cart (maybe user used Buy Now) - nothing to update
          continue;
        }

        // Normalize property: cartItem.qty or qty
        const cartQty = ensureNumber(cartItem.qty || cartItem.qty === 0 ? cartItem.qty : cartItem.qty);
        const orderedQty = ensureNumber(orderedItem.qty);

        const newQuantity = (typeof cartQty === 'number' ? cartQty : parseInt(cartQty || 0)) - orderedQty;

        if (newQuantity <= 0) {
          // remove from cart
          const removed = await removeItemFromDatabase(orderedItem.id);
          if (!removed) {
            console.warn(`Failed to remove cart item ${orderedItem.id} after order.`);
          }
        } else {
          // update to reduced quantity
          const updated = await updateCartQuantityInDatabase(orderedItem.id, newQuantity);
          if (!updated) {
            console.warn(`Failed to update cart item ${orderedItem.id} to qty ${newQuantity}`);
          }
        }
      }

      console.log('✅ Cart quantities updated after order');
    } catch (error) {
      console.error('Error reducing cart quantities after order:', error);
    }
  };

  // Load checkout data from localStorage and user data
  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Load user profile data for name and phone
      const userId = parsedUser.id || parsedUser.username;
      const userDataKey = `userData_${userId}`;
      const savedUserData = localStorage.getItem(userDataKey);
      
      if (savedUserData) {
        const userProfile = JSON.parse(savedUserData);
        
        // Set default recipient name from user profile
        const fullName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
        setAddress(prev => ({
          ...prev,
          recipient: fullName || parsedUser.username || '',
          contact: userProfile.phone || ''
        }));
      } else {
        setAddress(prev => ({
          ...prev,
          recipient: parsedUser.username || ''
        }));
      }
    }

    // Load saved address if exists
    const savedAddress = localStorage.getItem('userAddress');
    if (savedAddress) {
      const parsedAddress = JSON.parse(savedAddress);
      setAddress(prev => ({
        ...prev,
        ...parsedAddress
      }));
    }

    // Load checkout data from localStorage (from Buy Now or cart)
    const checkoutData = localStorage.getItem('checkoutData');
    if (checkoutData) {
      try {
        const parsedData = JSON.parse(checkoutData);
        console.log('🛒 Loaded checkout data from Buy Now or Cart:', parsedData);
        
        if (parsedData.items && parsedData.summary) {
          setOrderItems(parsedData.items);
          // Ensure numbers are properly converted
          const loadedSubtotal = ensureNumber(parsedData.summary.subtotal);
          const loadedTotal = ensureNumber(parsedData.summary.total);
          
          setSubtotal(loadedSubtotal);
          setTotal(loadedTotal);
        }
      } catch (error) {
        console.error('Error loading checkout data:', error);
        // Fallback to empty items
        setOrderItems([]);
      }
    } else {
      console.log('❌ No checkout data found - redirecting to cart');
      // If no checkout data, redirect to cart
      navigate('/cart');
    }
  }, [navigate]);

  // Recalculate totals when order items change
  useEffect(() => {
    if (orderItems.length > 0) {
      const newSubtotal = orderItems.reduce((sum, item) => {
        const price = ensureNumber(item.price);
        const quantity = ensureNumber(item.qty);
        return sum + (price * quantity);
      }, 0);
      
      setSubtotal(newSubtotal);
      setTotal(newSubtotal + SHIPPING_FEE);
    } else {
      // Reset to 0 if no items
      setSubtotal(0);
      setTotal(0);
    }
  }, [orderItems]);

  // Check stock availability before placing order
  const checkStockAvailability = async () => {
    const errors = [];
    
    for (const item of orderItems) {
      try {
        const response = await fetch(`http://localhost:5000/api/products/check-stock/${item.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ quantity: item.qty })
        });
        
        if (!response.ok) {
          const txt = await response.text();
          console.warn('Stock check returned non-OK:', txt);
        }

        const data = await response.json();
        if (!data.available) {
          errors.push({
            item: item.name,
            message: data.message,
            currentStock: data.current_stock,
            requested: item.qty
          });
        }
      } catch (error) {
        console.error(`Error checking stock for ${item.name}:`, error);
        errors.push({
          item: item.name,
          message: 'Error checking stock availability'
        });
      }
    }
    
    setStockErrors(errors);
    return errors.length === 0;
  };

  // 🔄 Handler for quantity changes - UPDATED: Now updates database cart in real-time
  const handleQtyChange = async (itemId, newQty) => {
    const qty = Math.max(1, parseInt(newQty) || 1);
    
    const updatedItems = orderItems.map(item =>
      item.id === itemId ? { ...item, qty: qty } : item
    );
    
    setOrderItems(updatedItems);
    
    // NEW: Update the quantity in the database cart in real-time
    await updateCartQuantityInDatabase(itemId, qty);
    
    // Clear stock errors when quantity changes
    setStockErrors([]);
  };

  // 🗑️ Handler for removing items - UPDATED: Now removes from database cart
  const handleRemoveItem = async (itemId) => {
    if (window.confirm('Remove this item from your order?')) {
      // Remove from local state first for immediate UI update
      const updatedItems = orderItems.filter(item => item.id !== itemId);
      setOrderItems(updatedItems);
      
      // Remove from database cart
      await removeItemFromDatabase(itemId);
      
      setStockErrors([]);

      // If no items left, redirect to cart
      if (updatedItems.length === 0) {
        navigate('/cart');
      }
    }
  };

  // 💰 Handler for payment method selection
  const handlePaymentChange = (event) => {
    setPaymentMethod(event.target.value);
  };

  // NEW: Handle image upload for payment proof
  const handleProofImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, GIF, WebP)');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }
      
      setProofImage(file);
    }
  };

  // NEW: Upload payment proof to backend (stock deduction happens in backend)
  const uploadPaymentProof = async () => {
    if (!proofImage) {
      alert('Please select a payment proof image');
      return;
    }

    if (!orderDetails || !orderDetails.orderId) {
      alert('Order details missing. Please complete the order first.');
      return;
    }

    setIsUploadingProof(true);

    try {
      const formData = new FormData();
      formData.append('orderId', orderDetails.orderId);
      formData.append('userId', user?.id || user?.username);
      formData.append('paymentProof', proofImage);
      formData.append('paymentMethod', paymentMethod);

      const response = await fetch('http://localhost:5000/api/orders/upload-payment-proof', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Payment proof uploaded and stock deducted:', result);
        
        // NEW: Reduce cart quantities after successful order
        // orderDetails.items is the list we submitted originally
        await reduceCartQuantitiesAfterOrder(orderDetails.items);
        
        // Close the modal and proceed with order confirmation
        setShowPaymentProofModal(false);
        completeOrderConfirmation();
      } else {
        const text = await response.text();
        let errorData;
        try { errorData = JSON.parse(text); } catch (e) { errorData = { error: text }; }
        throw new Error(errorData.error || 'Failed to upload payment proof');
      }
    } catch (error) {
      console.error('❌ Error uploading payment proof:', error);
      alert(`Failed to upload payment proof: ${error.message}`);
    } finally {
      setIsUploadingProof(false);
    }
  };

  // UPDATED: Handle QR payment completion - now shows payment proof modal
  const handleQRPaymentComplete = () => {
    setShowQRPayment(false);
    setShowPaymentProofModal(true);
  };

  // Complete order confirmation after payment
  const completeOrderConfirmation = () => {
    // Only clear checkout data, NOT the cart - like real e-commerce
    localStorage.removeItem('checkoutData');
    
    // Store order confirmation for order history
    localStorage.setItem('lastOrder', JSON.stringify({
      orderId: orderDetails.orderId,
      orderNumber: orderDetails.orderNumber,
      ...orderDetails
    }));

    // Mark order as confirmed
    setOrderConfirmed(true);
  };

  // ✅ Confirm Order (Checkout Confirmation) - UPDATED: No stock deduction here
  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    
    // Validation
    if (orderItems.length === 0) {
      alert('Your order is empty. Please add items to your cart first.');
      navigate('/shopping');
      return;
    }

    const hasZeroQty = orderItems.some(item => item.qty === 0);
    if (hasZeroQty) {
      alert('Please ensure all items have a quantity of at least 1.' );
      return;
    }

    if (!paymentMethod) {
      alert('Please select a payment method (Paymaya or GCash) to place your order.' );
      return;
    }

    // Validate required address fields
    if (!address.recipient || !address.contact || !address.street || !address.city) {
      alert('Please fill in all required address fields (Recipient, Contact, Street, City).');
      return;
    }

    // Check terms agreement
    if (!agreeToTerms) {
      alert('Please agree to the terms and conditions to proceed with your order.');
      return;
    }

    // Check stock availability (but don't deduct yet)
    setIsLoading(true);
    const stockAvailable = await checkStockAvailability();
    
    if (!stockAvailable) {
      setIsLoading(false);
      alert('Some items in your cart are no longer available in the requested quantities. Please review your order.');
      return;
    }

    try {
      // Prepare order data for backend
      const orderData = {
        userId: user?.id || user?.username,
        items: orderItems.map(item => ({
          id: item.id,
          name: item.name,
          price: ensureNumber(item.price),
          qty: item.qty,
          image: item.image,
          condition: item.condition,
          size: item.size,
          material: item.material,
          stock: item.stock,
          category: item.category || 'General'
        })),
        subtotal: ensureNumber(subtotal),
        shippingFee: SHIPPING_FEE,
        total: ensureNumber(total),
        paymentMethod: paymentMethod,
        shippingAddress: address,
        status: 'pending_payment', // Changed to pending_payment - stock not deducted yet
        orderDate: new Date().toISOString()
      };

      console.log('📦 Submitting order (stock not deducted yet):', orderData);

      // Send order to backend API
      const response = await fetch('http://localhost:5000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = 'Failed to place order';
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorDetails = JSON.stringify(errorData, null, 2);
        } catch (parseError) {
          console.error('❌ Error parsing error response:', parseError);
          errorDetails = await response.text();
        }
        
        console.error('❌ Server error details:', {
          status: response.status,
          statusText: response.statusText,
          details: errorDetails
        });
        
        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }

      const result = await response.json();
      console.log('✅ Order submitted successfully (stock reserved, not deducted):', result);

      // Set order details but don't confirm yet
      setOrderDetails({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        ...orderData
      });
      
      // Generate QR code and show payment step
      setQrCode(generateRandomQR());
      setShowQRPayment(true);
      
    } catch (error) {
      console.error('❌ Order submission failed:', error);
      alert(`Failed to submit order: ${error.message}\n\nPlease check the console for more details.`);
    } finally {
      setIsLoading(false);
    }
  };

  // 🏠 Continue Shopping after confirmation
  const handleContinueShopping = () => {
    navigate('/shopping');
  };

  // NEW: Payment Proof Modal Component
  const PaymentProofModal = () => (
    <div className="payment-proof-modal-overlay">
      <div className="payment-proof-modal">
        <div className="proof-modal-header">
          <h3>Upload Payment Proof</h3>
          <p>Please upload a screenshot or photo of your payment confirmation</p>
        </div>
        
        <div className="proof-upload-section">
          <div className="upload-area">
            <input
              type="file"
              id="payment-proof"
              accept="image/*"
              onChange={handleProofImageChange}
              className="proof-input"
            />
            <label htmlFor="payment-proof" className="upload-label">
              {proofImage ? (
                <div className="image-preview">
                  <img src={URL.createObjectURL(proofImage)} alt="Payment proof preview" />
                  <span>Change Image</span>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <div className="upload-icon">📁</div>
                  <p>Click to select payment proof image</p>
                  <small>Supported formats: JPG, PNG, GIF, WebP (Max 5MB)</small>
                </div>
              )}
            </label>
          </div>
          
          <div className="payment-details-summary">
            <h4>Payment Details:</h4>
            <div className="payment-summary-item">
              <span>Order Number:</span>
              <strong>{orderDetails?.orderNumber}</strong>
            </div>
            <div className="payment-summary-item">
              <span>Amount Paid:</span>
              <strong>₱{ensureNumber(total).toFixed(2)}</strong>
            </div>
            <div className="payment-summary-item">
              <span>Payment Method:</span>
              <span>{paymentMethod === 'paymaya' ? 'PayMaya' : 'GCash'}</span>
            </div>
          </div>
        </div>

        <div className="proof-modal-actions">
          <button 
            className="cancel-proof-btn"
            onClick={() => setShowPaymentProofModal(false)}
            disabled={isUploadingProof}
          >
            Cancel
          </button>
          <button 
            className={`submit-proof-btn ${isUploadingProof ? 'loading' : ''}`}
            onClick={uploadPaymentProof}
            disabled={isUploadingProof || !proofImage}
          >
            {isUploadingProof ? 'Uploading...' : 'Submit Payment Proof'}
          </button>
        </div>

        <div className="proof-note">
          <p>💡 <strong>Note:</strong> Your order will be processed and stock will be deducted once we verify your payment proof.</p>
        </div>
      </div>
    </div>
  );

  // QR Payment Modal Component
  const QRPaymentModal = () => (
    <div className="qr-payment-modal-overlay">
      <div className="qr-payment-modal">
        <div className="qr-modal-header">
          <h3>Complete Your Payment</h3>
          <p>Scan the QR code below using your {paymentMethod === 'paymaya' ? 'PayMaya' : 'GCash'} app</p>
        </div>
        
        <div className="qr-code-container">
          <img src={qrCode} alt="Payment QR Code" className="qr-code-image" />
          <div className="payment-details">
            <div className="payment-amount">
              <span>Amount to Pay:</span>
              <strong>₱{ensureNumber(total).toFixed(2)}</strong>
            </div>
            <div className="payment-method">
              <span>Payment Method:</span>
              <span>{paymentMethod === 'paymaya' ? 'PayMaya' : 'GCash'}</span>
            </div>
            <div className="order-reference">
              <span>Order Reference:</span>
              <span>{orderDetails?.orderNumber}</span>
            </div>
          </div>
        </div>

        <div className="payment-instructions">
          <h4>Instructions:</h4>
          <ol>
            <li>Open your {paymentMethod === 'paymaya' ? 'PayMaya' : 'GCash'} app</li>
            <li>Tap "Scan QR" or "Pay QR"</li>
            <li>Point your camera at the QR code above</li>
            <li>Enter the amount: <strong>₱{ensureNumber(total).toFixed(2)}</strong></li>
            <li>Confirm the payment</li>
          </ol>
        </div>

        <div className="qr-modal-actions">
          <button 
            className="cancel-payment-btn"
            onClick={() => setShowQRPayment(false)}
            disabled={isLoading}
          >
            Cancel Payment
          </button>
          <button 
            className={`complete-payment-btn ${isLoading ? 'loading' : ''}`}
            onClick={handleQRPaymentComplete}
            disabled={isLoading}
          >
            {isLoading ? 'Verifying Payment...' : 'I Have Completed Payment'}
          </button>
        </div>

        <div className="payment-note">
          <p>💡 <strong>Note:</strong> You will be asked to upload payment proof after completing the payment. Stock will be deducted only after payment verification.</p>
        </div>
      </div>
    </div>
  );

  // 📋 Terms and Conditions Modal
  const TermsAndConditionsModal = () => (
    <div className="terms-modal-overlay">
      <div className="terms-modal">
        <div className="terms-modal-header">
          <h3>Terms and Conditions</h3>
          <button 
            className="close-modal-btn"
            onClick={() => setShowTermsModal(false)}
          >
            ×
          </button>
        </div>
        <div className="terms-modal-content">
          <h4>Old Goods Thrift Store - Terms of Service</h4>
          
          <div className="terms-section">
            <h5>1. Order Confirmation</h5>
            <p>All orders are subject to acceptance and availability. By placing an order, you agree to these terms and conditions.</p>
          </div>

          <div className="terms-section">
            <h5>2. Pricing and Payment</h5>
            <p>All prices are in Philippine Peso (₱). Payment must be made in full before order processing.</p>
          </div>

          <div className="terms-section">
            <h5>3. Shipping and Delivery</h5>
            <p>• Standard shipping fee: ₱50.00</p>
            <p>• Delivery time: 3-7 business days</p>
            <p>• We are not responsible for delays caused by courier services</p>
          </div>

          <div className="terms-section">
            <h5>4. Return and Refund Policy</h5>
            <p><strong>ALL SALES ARE FINAL.</strong> Due to the nature of thrift items:</p>
            <p>• No returns or exchanges accepted</p>
            <p>• No refunds for change of mind</p>
            <p>• Items are sold "as-is" with all imperfections noted</p>
          </div>

          <div className="terms-section">
            <h5>5. Product Condition</h5>
            <p>All items are pre-owned and may show signs of wear. Product conditions are accurately described in the listings.</p>
          </div>

          <div className="terms-section">
            <h5>6. Cancellation Policy</h5>
            <p>Orders can only be cancelled within your checkout. Once order processing begins, cancellations are no longer accepted.</p>
          </div>

          <div className="terms-section">
            <h5>7. Privacy Policy</h5>
            <p>We collect personal information for order processing and delivery purposes only. Your information is kept confidential.</p>
          </div>

          <div className="terms-section">
            <h5>8. Contact Information</h5>
            <p>For order inquiries: support@oldgoodsthrift.com</p>
            <p>Customer service: (02) 1234-5678</p>
          </div>

          <div className="terms-notice">
            <p><strong>By proceeding with your order, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.</strong></p>
          </div>
        </div>
        <div className="terms-modal-footer">
          <button 
            className="agree-terms-btn"
            onClick={() => {
              setAgreeToTerms(true);
              setShowTermsModal(false);
            }}
          >
            I Understand and Agree
          </button>
        </div>
      </div>
    </div>
  );

  // Stock error display
  const StockErrorsDisplay = () => {
    if (stockErrors.length === 0) return null;
    
    return (
      <div className="stock-errors">
        <h4>⚠️ Stock Issues</h4>
        {stockErrors.map((error, index) => (
          <div key={index} className="stock-error-item">
            <strong>{error.item}:</strong> {error.message}
            {error.currentStock !== undefined && (
              <span> (Available: {error.currentStock}, Requested: {error.requested})</span>
            )}
          </div>
        ))}
        <p>Please adjust quantities or remove unavailable items to proceed.</p>
      </div>
    );
  };

  // If order is confirmed, show confirmation screen
  if (orderConfirmed && orderDetails) {
    return (
      <div className="order-confirmation">
        <header className="header">
          <div className="header-left">
            <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
            <h2>Old Goods Thrift</h2>
          </div>
        </header>

        <main className="confirmation-container">
          <div className="confirmation-card">
            <div className="confirmation-header">
              <div className="success-icon">✓</div>
              <h2>Order Confirmed!</h2>
              <p className="confirmation-message">
                Thank you for your purchase. Your order has been confirmed and stock has been deducted.
              </p>
            </div>

            <div className="order-details">
              <h3>Order Details</h3>
              <div className="detail-row">
                <span>Order Number:</span>
                <strong>{orderDetails.orderNumber}</strong>
              </div>
              <div className="detail-row">
                <span>Order Date:</span>
                <span>{new Date(orderDetails.orderDate).toLocaleDateString()}</span>
              </div>
              <div className="detail-row">
                <span>Total Amount:</span>
                <strong>₱{ensureNumber(orderDetails.total).toFixed(2)}</strong>
              </div>
              <div className="detail-row">
                <span>Payment Method:</span>
                <span>{orderDetails.paymentMethod}</span>
              </div>
              <div className="detail-row">
                <span>Payment Status:</span>
                <span className="status-paid">Paid</span>
              </div>
            </div>

            <div className="shipping-details">
              <h3>Shipping Address</h3>
              <p>{orderDetails.shippingAddress.recipient}</p>
              <p>{orderDetails.shippingAddress.contact}</p>
              <p>{orderDetails.shippingAddress.street}</p>
              <p>
                {orderDetails.shippingAddress.barangay && `${orderDetails.shippingAddress.barangay}, `}
                {orderDetails.shippingAddress.city}
                {orderDetails.shippingAddress.province && `, ${orderDetails.shippingAddress.province}`}
              </p>
            </div>

            <div className="order-items-summary">
              <h3>Order Items ({orderDetails.items.length})</h3>
              {orderDetails.items.map(item => (
                <div key={item.id} className="confirmation-item">
                  <img src={item.image} alt={item.name} />
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    <p>Quantity: {item.qty}</p>
                    <p>₱{(ensureNumber(item.price) * ensureNumber(item.qty)).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="order-notes">
              <h4>Important Notes:</h4>
              <ul>
                <li>Your order will be processed within 24 hours</li>
                <li>Delivery time: 3-7 business days</li>
                <li>For inquiries: support@oldgoodsthrift.com</li>
              </ul>
            </div>

            <div className="confirmation-actions">
              <button 
                className="continue-shopping-btn"
                onClick={handleContinueShopping}
              >
                Continue Shopping
              </button>
              <Link to="/order-history" className="view-orders-link">
                View Order History
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If no items in order, redirect to cart
  if (orderItems.length === 0 && !orderConfirmed) {
    return (
      <div className="empty-checkout">
        <header className="header">
          <div className="header-left">
            <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
            <h2>Old Goods Thrift</h2>
          </div>
          <Link className="back-link" to="/shopping">Back to Shop</Link>
        </header>
        <div className="empty-message">
          <h3>No items to checkout</h3>
          <p>Your checkout data is missing or invalid.</p>
          <Link to="/cart" className="btn-primary">Go to Cart</Link>
          <Link to="/shopping" className="btn-secondary">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
          <h2>Old Goods Thrift</h2>
        </div>
        <Link className="back-link" to="/shopping">Back to Shop</Link>
      </header>

      <main className="checkout-container">
        <h2>Checkout Confirmation ({orderItems.length} item{orderItems.length !== 1 ? 's' : ''})</h2>

        {/* Stock Errors Display */}
        <StockErrorsDisplay />

        {/* 📦 Delivery Address */}
        <section className="checkout-section address-section">
          <div className="section-header">
            <h3>Delivery Address</h3>
            <Link to="/profile" className="manage-address-link">
              Manage Addresses
            </Link>
          </div>
          
          {/* Address Display (Read-only from profile) */}
          <div className="address-display">
            <div className="address-field">
              <label>Recipient Name:</label>
              <input 
                type="text" 
                value={address.recipient || ''} 
                readOnly 
                className="readonly-input"
                placeholder="Set in your profile"
              />
            </div>
            <div className="address-field">
              <label>Contact Number:</label>
              <input 
                type="tel" 
                value={address.contact || ''} 
                readOnly 
                className="readonly-input"
                placeholder="Set in your profile"
              />
            </div>
            <div className="address-field">
              <label>Street Address:</label>
              <input 
                type="text" 
                value={address.street || ''} 
                readOnly 
                className="readonly-input"
                placeholder="Set in your profile addresses"
              />
            </div>
            <div className="form-row">
              <div className="address-field">
                <label>Barangay:</label>
                <input 
                  type="text" 
                  value={address.barangay || ''} 
                  readOnly 
                  className="readonly-input"
                  placeholder="Optional"
                />
              </div>
              <div className="address-field">
                <label>City/Municipality:</label>
                <input 
                  type="text" 
                  value={address.city || ''} 
                  readOnly 
                  className="readonly-input"
                  placeholder="Set in your profile addresses"
                />
              </div>
            </div>
            <div className="address-field">
              <label>Province:</label>
              <input 
                type="text" 
                value={address.province || ''} 
                readOnly 
                className="readonly-input"
                placeholder="Optional"
              />
            </div>
          </div>
          
          <div className="address-note">
            <p>💡 <strong>Note:</strong> To update your shipping address, please go to your <Link to="/profile">Profile</Link> page and set an address as default.</p>
          </div>
        </section>

        {/* 🛍️ Order Items */}
        <section className="checkout-section items-section">
          <h3>Order Items</h3>
          <div className="items-list">
            {orderItems.map(item => (
              <div className="order-item" key={item.id}>
                <div className="item-image">
                  <img src={item.image} alt={item.name} />
                </div>
                <div className="item-details">
                  <h4>{item.name}</h4>
                  <p className="item-condition">{item.condition}</p>
                  {item.size && <p className="item-size">Size: {item.size}</p>}
                  {item.material && <p className="item-material">Material: {item.material}</p>}
                  <p className="item-price">₱{ensureNumber(item.price).toFixed(2)}</p>
                  <p className="stock-info">Available: {item.stock}</p>
                </div>
                <div className="item-quantity">
                  <label>Qty:</label>
                  <input 
                    type="number" 
                    className="quantity-input" 
                    min="1" 
                    max={item.stock}
                    value={item.qty} 
                    onChange={(e) => handleQtyChange(item.id, e.target.value)}
                  />
                  <button 
                    className="remove-item-btn"
                    onClick={() => handleRemoveItem(item.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 💳 Payment Method */}
        <section className="checkout-section payment-section">
          <h3>Payment Method</h3>
          <div className="payment-options">
            <label className="payment-option">
              <input 
                type="radio" 
                name="payment" 
                value="paymaya" 
                checked={paymentMethod === 'paymaya'}
                onChange={handlePaymentChange}
              /> 
              <span className="custom-radio"></span>
              <span className="payment-label">Paymaya</span>
            </label>
            <label className="payment-option">
              <input 
                type="radio" 
                name="payment" 
                value="gcash" 
                checked={paymentMethod === 'gcash'}
                onChange={handlePaymentChange}
              /> 
              <span className="custom-radio"></span>
              <span className="payment-label">GCash</span>
            </label>
          </div>
        </section>

        {/* 💸 Order Summary */}
        <section className="checkout-section summary-section">
          <h3>Order Summary</h3>
          <div className="summary-items">
            <div className="summary-item">
              <span>Subtotal ({orderItems.reduce((sum, item) => sum + ensureNumber(item.qty), 0)} items)</span>
              <span>₱{ensureNumber(subtotal).toFixed(2)}</span>
            </div>
            <div className="summary-item">
              <span>Shipping Fee</span>
              <span>₱{SHIPPING_FEE.toFixed(2)}</span>
            </div>
            <div className="summary-total">
              <span>Total Amount</span>
              <span>₱{ensureNumber(total).toFixed(2)}</span>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="terms-section">
            <label className="terms-agreement">
              <input 
                type="checkbox" 
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
              />
              <span className="checkmark"></span>
                I agree to the <button 
                type="button" 
                className="terms-link"
                onClick={() => setShowTermsModal(true)}
              >
                Terms and Conditions
              </button>
            </label>
          </div>

          {/* Order Actions */}
          <div className="order-actions">
            <button 
              className={`confirm-order-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleConfirmOrder}
              disabled={isLoading || !agreeToTerms || stockErrors.length > 0}
            >
              {isLoading ? 'Processing...' : `Proceed to Payment - ₱${ensureNumber(total).toFixed(2)}`}
            </button>
          </div>
        </section>
      </main>

      {/* QR Payment Modal */}
      {showQRPayment && <QRPaymentModal />}

      {/* Payment Proof Modal */}
      {showPaymentProofModal && <PaymentProofModal />}

      {/* Terms and Conditions Modal */}
      {showTermsModal && <TermsAndConditionsModal />}

      <Footer/>
    </>
  );
}

export default CheckoutPage;
