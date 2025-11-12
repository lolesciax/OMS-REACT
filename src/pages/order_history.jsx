import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/orders.css';
import Footer from '../components/Footer';

function OrderHistory() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showProofModal, setShowProofModal] = useState(false);
    const [proofImage, setProofImage] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchOrderHistory();
    }, []);

    const fetchOrderHistory = async () => {
        try {
            setLoading(true);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            if (!user.id && !user.username) {
                setError('User not found. Please login again.');
                return;
            }

            const userId = user.id || user.username;
            const response = await fetch(`http://localhost:5000/api/orders/user/${userId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                setOrders(data.orders || []);
            } else {
                throw new Error(data.error || 'Failed to load orders');
            }
        } catch (error) {
            console.error('Error fetching order history:', error);
            setError('Failed to load order history. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadgeClass = (status) => {
        if (!status) return 'status-badge status-pending';
        return `status-badge status-${status.toLowerCase()}`;
    };

    const handleProofImageSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setProofImage(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const confirmOrderReceipt = async () => {
        if (!proofImage) {
            alert('Please select a proof image first.');
            return;
        }

        try {
            setUploading(true);
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            const response = await fetch(`http://localhost:5000/api/orders/${selectedOrder._id}/confirm-receipt`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id || user.username,
                    proofImage: proofImage
                })
            });

            if (response.ok) {
                const result = await response.json();
                alert('Order confirmed as received! Thank you for your purchase.');
                setShowProofModal(false);
                setProofImage(null);
                setSelectedOrder(null);
                // Refresh the orders list
                fetchOrderHistory();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to confirm order receipt');
            }
        } catch (error) {
            console.error('Error confirming order receipt:', error);
            alert('Failed to confirm order receipt. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const openProofModal = (order) => {
        setSelectedOrder(order);
        setShowProofModal(true);
    };

    const closeProofModal = () => {
        setShowProofModal(false);
        setProofImage(null);
        setSelectedOrder(null);
    };

    const renderOrdersContent = () => {
        if (loading) {
            return (
                <div className="orders-card">
                    <h2>My Orders</h2>
                    <p>Loading your orders...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="orders-card">
                    <h2>My Orders</h2>
                    <p className="error-message">{error}</p>
                    <button onClick={fetchOrderHistory} className="btn retry-btn">
                        Try Again
                    </button>
                </div>
            );
        }

        if (orders.length === 0) {
            return (
                <div className="orders-card empty-state">
                    <h2>My Orders</h2>
                    <p>You haven't ordered anything yet.</p>
                    <img src="/empty-cart.png" alt="No Orders" className="empty-img" />
                    <div className="orders-actions">
                        <Link to="/shopping" className="btn back-btn">Go to Shopping</Link>
                        <Link to="/profile" className="btn profile-btn">Go to Profile</Link>
                    </div>
                </div>
            );
        }

        return (
            <div className="orders-card">
                <h2>My Orders <span className="orders-count">{orders.length}</span></h2>
                <div className="orders-list">
                    {orders.map((order) => (
                        <div key={order._id} className="order-item">
                            <div className="order-header">
                                <div className="order-info">
                                    <h3>Order #{order.orderNumber}</h3>
                                    <p className="order-date">Ordered at: {formatDate(order.orderDate)}</p>
                                </div>
                                <div className="order-status">
                                    <span className={getStatusBadgeClass(order.status)}>
                                        {order.status || 'Pending'}
                                    </span>
                                    <p className="order-total">₱{order.total?.toFixed(2)}</p>
                                </div>
                            </div>
                            
                            <div className="order-items-preview">
                                {order.items?.slice(0, 3).map((item, index) => (
                                    <div key={index} className="preview-item">
                                        <img 
                                            src={item.image || '/images/placeholder.jpg'} 
                                            alt={item.name}
                                            onError={(e) => {
                                                e.target.src = '/images/placeholder.jpg';
                                            }}
                                        />
                                        <span>{item.name} × {item.qty || item.quantity}</span>
                                    </div>
                                ))}
                                {order.items?.length > 3 && (
                                    <div className="more-items">
                                        +{order.items.length - 3} more items
                                    </div>
                                )}
                            </div>

                            <div className="order-footer">
                                <div className="order-shipping">
                                    <strong>Shipping to:</strong> {order.shippingAddress?.street}, {order.shippingAddress?.city}
                                </div>
                                {/* Confirm Receipt Button - Only show for shipped orders */}
                                {order.status === 'shipped' && (
                                    <button 
                                        onClick={() => openProofModal(order)}
                                        className="btn confirm-receipt-btn"
                                    >
                                        Confirm Receipt
                                    </button>
                                )}
                                {order.status === 'completed' && (
                                    <div className="receipt-confirmed">
                                        ✅ Order Completed
                                        {order.receiptProof && (
                                            <span className="proof-available"> (Proof Submitted)</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <>
            <header className="header">
                <div className="logo">
                    <img src="/Shop Icon.jpg" alt="Shop Logo" />
                    <h2>Old Goods Thrift</h2>
                </div>
                <Link className="back-link" to="/shopping">Back to Shop</Link>
            </header>

            <main className="orders-container">
                {renderOrdersContent()}
            </main>

            {/* Proof Upload Modal */}
            {showProofModal && (
                <div className="modal-overlay">
                    <div className="modal-content proof-modal">
                        <div className="modal-header">
                            <h3>Confirm Order Receipt</h3>
                            <button className="modal-close" onClick={closeProofModal}>×</button>
                        </div>
                        <div className="modal-body">
                            <p>Please upload a photo as proof of receipt for order <strong>#{selectedOrder?.orderNumber}</strong></p>
                            
                            <div className="proof-upload-area">
                                <input
                                    type="file"
                                    id="proofImage"
                                    accept="image/*"
                                    onChange={handleProofImageSelect}
                                    className="proof-input"
                                />
                                <label htmlFor="proofImage" className="proof-upload-label">
                                    {proofImage ? (
                                        <img src={proofImage} alt="Proof" className="proof-preview" />
                                    ) : (
                                        <div className="proof-placeholder">
                                            <span>📷</span>
                                            <p>Click to upload proof photo</p>
                                        </div>
                                    )}
                                </label>
                            </div>

                            <div className="proof-actions">
                                <button 
                                    onClick={confirmOrderReceipt}
                                    disabled={!proofImage || uploading}
                                    className="btn primary-btn submit-proof-btn"
                                >
                                    {uploading ? 'Uploading...' : 'Submit Proof'}
                                </button>
                                <button 
                                    onClick={closeProofModal}
                                    className="btn secondary-btn"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
<Footer/>
        </>
    );
}

export default OrderHistory;