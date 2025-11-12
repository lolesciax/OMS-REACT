import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/payment.css';
import Footer from '../components/Footer';

// Get user-specific storage key
const getUserPaymentKey = (userId) => `userPayment_${userId}`;

function Payment() {
    const navigate = useNavigate();
    const [selectedPayment, setSelectedPayment] = useState('');
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [orderDetails, setOrderDetails] = useState(null);
    const [user, setUser] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState(''); // pending, success, failed

    // QR images for different payment methods
    const qrImages = {
        gcash: [
            "/qr-gcash-1.png",
            "/qr-gcash-2.png"
        ],
        paymaya: [
            "/qr-paymaya-1.png",
            "/qr-paymaya-2.png"
        ]
    };

    // Load user and payment data
    useEffect(() => {
        const loadPaymentData = async () => {
            try {
                // Get user from localStorage
                const userData = localStorage.getItem('user');
                if (userData) {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);
                    
                    // Load checkout data
                    const checkoutData = localStorage.getItem('checkoutData');
                    if (checkoutData) {
                        const parsedCheckout = JSON.parse(checkoutData);
                        setOrderDetails(parsedCheckout);
                        setPaymentAmount(parsedCheckout.summary?.total || 0);
                    } else {
                        alert('No checkout data found. Please complete your order first.');
                        navigate('/cart');
                        return;
                    }
                } else {
                    navigate('/login');
                    return;
                }

            } catch (error) {
                console.error('Error loading payment data:', error);
                alert('Error loading payment information. Please try again.');
                navigate('/cart');
            }
        };

        loadPaymentData();
    }, [navigate]);

    // Handle payment method selection
    const handlePaymentSelect = (method) => {
        setSelectedPayment(method);
        
        // In real app, you might want to save the selected payment method
        if (user && orderDetails) {
            const userId = user.id || user.username;
            const userPaymentKey = getUserPaymentKey(userId);
            
            const paymentData = {
                method: method,
                amount: paymentAmount,
                orderId: orderDetails.orderId,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            
            localStorage.setItem(userPaymentKey, JSON.stringify(paymentData));
        }
    };

    // Get random QR code for selected payment method
    const getRandomQR = () => {
        if (!selectedPayment || !qrImages[selectedPayment]) return '';
        const qrList = qrImages[selectedPayment];
        return qrList[Math.floor(Math.random() * qrList.length)];
    };

    // Simulate payment processing
    const simulatePayment = () => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // 90% success rate for demo
                const isSuccess = Math.random() > 0.1;
                if (isSuccess) {
                    resolve({ success: true, transactionId: 'TXN_' + Date.now() });
                } else {
                    reject(new Error('Payment failed. Please try again.'));
                }
            }, 3000);
        });
    };

    // Handle payment confirmation
    const handleConfirmPayment = async () => {
        if (!selectedPayment) {
            alert('Please select a payment method.');
            return;
        }

        if (!user) {
            alert('Please log in to complete payment.');
            navigate('/login');
            return;
        }

        setIsProcessing(true);
        setPaymentStatus('processing');

        try {
            // Simulate API call to payment gateway
            const paymentResult = await simulatePayment();
            
            if (paymentResult.success) {
                // Save successful payment
                await saveSuccessfulPayment(paymentResult.transactionId);
                
                setPaymentStatus('success');
                alert(`✅ Payment confirmed! Transaction ID: ${paymentResult.transactionId}\nThank you for shopping with Old Goods Thrift.`);
                
                // Clear cart and checkout data
                clearOrderData();
                
                // Redirect to order confirmation
                navigate('/order-history');
            }
        } catch (error) {
            setPaymentStatus('failed');
            alert(`❌ ${error.message}`);
            console.error('Payment error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    // Save successful payment to user-specific storage
    const saveSuccessfulPayment = async (transactionId) => {
        if (!user || !orderDetails) return;

        const userId = user.id || user.username;
        
        // Save payment record
        const paymentRecord = {
            transactionId,
            method: selectedPayment,
            amount: paymentAmount,
            orderId: orderDetails.orderId || `ORD_${Date.now()}`,
            timestamp: new Date().toISOString(),
            status: 'completed',
            items: orderDetails.items || [],
            shippingAddress: orderDetails.shippingAddress || {}
        };

        // Save to user payments
        const userPaymentsKey = `userPayments_${userId}`;
        const existingPayments = JSON.parse(localStorage.getItem(userPaymentsKey) || '[]');
        const updatedPayments = [...existingPayments, paymentRecord];
        localStorage.setItem(userPaymentsKey, JSON.stringify(updatedPayments));

        // Save to user orders
        const userOrdersKey = `userOrders_${userId}`;
        const existingOrders = JSON.parse(localStorage.getItem(userOrdersKey) || '[]');
        
        const newOrder = {
            id: paymentRecord.orderId,
            date: paymentRecord.timestamp,
            status: 'pending', // Order status, not payment status
            total: paymentAmount,
            items: orderDetails.items || [],
            shippingAddress: orderDetails.shippingAddress || {},
            paymentMethod: selectedPayment,
            transactionId: transactionId
        };

        const updatedOrders = [...existingOrders, newOrder];
        localStorage.setItem(userOrdersKey, JSON.stringify(updatedOrders));

        console.log(`💳 Payment saved for user ${userId}:`, paymentRecord);
    };

    // Clear order data after successful payment
    const clearOrderData = () => {
        localStorage.removeItem('checkoutData');
        
        if (user) {
            const userId = user.id || user.username;
            const userCartKey = `shoppingCart_${userId}`;
            localStorage.removeItem(userCartKey);
        }
    };

    // Handle cancel payment
    const handleCancelPayment = () => {
        if (window.confirm('Are you sure you want to cancel this payment? Your cart items will be preserved.')) {
            navigate('/cart');
        }
    };

    // Format currency
    const formatCurrency = (amount) => {
        return `₱${amount.toFixed(2)}`;
    };

    if (!user) {
        return (
            <div className="loading-container">
                <header className="header">
                    <div className="header-left">
                        <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
                        <h2>Old Goods Thrift</h2>
                    </div>
                    <Link to="/shopping" className="back-link">Back to Shop</Link>
                </header>
                <div className="loading">Loading payment...</div>
            </div>
        );
    }

    if (!orderDetails) {
        return (
            <div className="error-container">
                <header className="header">
                    <div className="header-left">
                        <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
                        <h2>Old Goods Thrift</h2>
                    </div>
                    <Link to="/shopping" className="back-link">Back to Shop</Link>
                </header>
                <div className="error-message">
                    <h3>No order found</h3>
                    <p>Please complete your order first.</p>
                    <Link to="/cart" className="btn-primary">Go to Cart</Link>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* HEADER */}
            <header className="header">
                <div className="header-left">
                    <img src="/Shop Icon.jpg" alt="Logo" className="logo" />
                    <h2>Old Goods Thrift</h2>
                </div>
                <Link to="/shopping" className="back-link">Back to Shop</Link>
            </header>

            {/* PAYMENT CONTAINER */}
            <main className="payment-container">
                <div className="payment-card">
                    <h2>Payment Method</h2>
                    <p>Please select your preferred payment option:</p>

                    {/* Payment Options */}
                    <div className="payment-options">
                        <label className={selectedPayment === 'gcash' ? 'selected' : ''}>
                            <input 
                                type="radio" 
                                name="payment" 
                                value="gcash" 
                                checked={selectedPayment === 'gcash'}
                                onChange={() => handlePaymentSelect('gcash')}
                                disabled={isProcessing}
                            /> 
                            GCash
                        </label>
                        <label className={selectedPayment === 'paymaya' ? 'selected' : ''}>
                            <input 
                                type="radio" 
                                name="payment" 
                                value="paymaya" 
                                checked={selectedPayment === 'paymaya'}
                                onChange={() => handlePaymentSelect('paymaya')}
                                disabled={isProcessing}
                            /> 
                            PayMaya
                        </label>
                    </div>

                    {/* QR Section */}
                    {selectedPayment && (
                        <div className="qr-section">
                            <h3>Scan to Pay</h3>
                            <img 
                                src={getRandomQR()} 
                                alt={`${selectedPayment} QR Code`} 
                                className="qr-img" 
                            />
                            <p className="qr-instruction">
                                Open your {selectedPayment === 'gcash' ? 'GCash' : 'PayMaya'} app and scan this QR code to pay
                            </p>
                        </div>
                    )}

                    {/* Order Summary */}
                    <div className="order-summary">
                        <h3>Order Summary</h3>
                        <div className="summary-item">
                            <span>Items ({orderDetails.items?.reduce((sum, item) => sum + item.qty, 0) || 0}):</span>
                            <span>{formatCurrency(orderDetails.summary?.subtotal || 0)}</span>
                        </div>
                        <div className="summary-item">
                            <span>Shipping:</span>
                            <span>{formatCurrency(orderDetails.summary?.shipping || 0)}</span>
                        </div>
                        <div className="summary-total">
                            <span>Total Amount:</span>
                            <span>{formatCurrency(paymentAmount)}</span>
                        </div>
                    </div>

                    {/* Payment Actions */}
                    <div className="payment-actions">
                        <button 
                            className="btn cancel-btn"
                            onClick={handleCancelPayment}
                            disabled={isProcessing}
                        >
                            Cancel
                        </button>
                        <button 
                            className={`btn confirm-btn ${isProcessing ? 'processing' : ''}`}
                            onClick={handleConfirmPayment}
                            disabled={!selectedPayment || isProcessing}
                        >
                            {isProcessing ? 'Processing...' : 'Confirm Payment'}
                        </button>
                    </div>

                    {/* Payment Status */}
                    {paymentStatus === 'processing' && (
                        <div className="payment-status processing">
                            ⏳ Processing your payment...
                        </div>
                    )}
                    {paymentStatus === 'success' && (
                        <div className="payment-status success">
                            ✅ Payment successful! Redirecting...
                        </div>
                    )}
                    {paymentStatus === 'failed' && (
                        <div className="payment-status failed">
                            ❌ Payment failed. Please try again.
                        </div>
                    )}
                </div>
            </main>

           <Footer/>
        </>
    );
}

export default Payment;