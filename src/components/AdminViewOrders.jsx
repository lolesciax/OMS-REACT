import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminFooter from './AdminFooter';

function AdminViewOrders() {
    const navigate = useNavigate();
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkAdminAccess();
        if (orderId) {
            fetchOrderDetails();
        }
    }, [orderId]);

    const checkAdminAccess = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.isAdmin) {
            navigate('/shopping');
        }
    };

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            
            console.log(`🔍 Fetching order details for: ${orderId}`);
            
            // Try the admin endpoint first
            let response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}`);
            
            // If admin endpoint fails, try the regular orders endpoint
            if (!response.ok) {
                console.log('🔄 Admin endpoint failed, trying regular orders endpoint...');
                response = await fetch(`http://localhost:5000/api/orders/${orderId}`);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ Order data received:', data);
            
            if (data.success) {
                // Ensure all item images have full URLs
                const processedOrder = processOrderImages(data.order);
                setOrder(processedOrder);
            } else {
                throw new Error(data.error || 'Failed to load order details');
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
            setError('Failed to load order details. Please check if the backend server is running.');
        } finally {
            setLoading(false);
        }
    };

    // Function to process order images and ensure full URLs
    const processOrderImages = (orderData) => {
        if (!orderData) return orderData;
        
        console.log('🖼️ Processing images for order:', orderData);
        
        // Process item images
        if (orderData.items && Array.isArray(orderData.items)) {
            orderData.items = orderData.items.map(item => ({
                ...item,
                image: getFullImageUrl(item.image)
            }));
        }
        
        // Process payment proof - FIXED: Better URL handling
        if (orderData.paymentProof) {
            console.log('💰 Processing payment proof:', orderData.paymentProof);
            orderData.paymentProof = getFullImageUrl(orderData.paymentProof);
        }
        
        return orderData;
    };

    // FIXED: Function to get full image URL for any image path
    const getFullImageUrl = (imagePath) => {
        console.log('🔗 Converting image path:', imagePath);
        
        if (!imagePath || imagePath === 'null' || imagePath === 'undefined') {
            console.log('❌ No image path provided');
            return '/images/placeholder.jpg'; // Use local placeholder instead
        }
        
        // If it's already a full URL, return as is
        if (imagePath.startsWith('http')) {
            console.log('✅ Already full URL:', imagePath);
            return imagePath;
        }
        
        // If it starts with /static/uploads/, construct full URL
        if (imagePath.startsWith('/static/uploads/')) {
            const fullUrl = `http://localhost:5000${imagePath}`;
            console.log('🔧 Built static uploads URL:', fullUrl);
            return fullUrl;
        }
        
        // If it starts with /static/, construct full URL
        if (imagePath.startsWith('/static/')) {
            const fullUrl = `http://localhost:5000${imagePath}`;
            console.log('🔧 Built static URL:', fullUrl);
            return fullUrl;
        }
        
        // If it starts with /, construct full URL
        if (imagePath.startsWith('/')) {
            const fullUrl = `http://localhost:5000${imagePath}`;
            console.log('🔧 Built root URL:', fullUrl);
            return fullUrl;
        }
        
        // Otherwise, assume it's in uploads directory
        const fullUrl = `http://localhost:5000/static/uploads/${imagePath}`;
        console.log('🔧 Built uploads URL:', fullUrl);
        return fullUrl;
    };

    const updateOrderStatus = async (newStatus) => {
        try {
            setError(null);
            console.log(`🔄 Updating order status to: ${newStatus}`);
            
            const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Status update successful:', result);
                fetchOrderDetails();
                alert(result.message || 'Order status updated successfully!');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update order status');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            setError(error.message || 'Error updating order status. Please try again.');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const getStatusBadgeClass = (status) => {
        if (!status) return 'status-badge status-unknown';
        return `status-badge status-${status.toLowerCase()}`;
    };

    const parseShippingAddress = (address) => {
        if (!address) return 'No shipping address provided';
        
        if (typeof address === 'string') {
            try {
                address = JSON.parse(address);
            } catch (e) {
                return address;
            }
        }
        
        if (typeof address === 'object') {
            const parts = [
                address.street,
                address.city,
                address.state,
                address.zipCode,
                address.country
            ].filter(part => part && part.trim() !== '');
            
            return parts.join(', ') || 'No shipping address provided';
        }
        
        return 'No shipping address provided';
    };

    // FIXED: Better image error handling with data URL fallback
    const handleImageError = (e, imageType = 'product') => {
        console.error(`❌ Failed to load ${imageType} image:`, e.target.src);
        
        // Use a data URL as fallback to avoid server requests
        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2Ij5JbWFnZSBub3QgYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
        e.target.alt = `${imageType} not available`;
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dashboard-content" style={{ textAlign: 'center', padding: '50px' }}>
                    <p>Loading order details...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="dashboard">
                <div className="dashboard-content" style={{ textAlign: 'center', padding: '50px' }}>
                    <p>Order not found.</p>
                    {error && <p style={{ color: 'red' }}>{error}</p>}
                    <button onClick={fetchOrderDetails} className="btn retry-btn">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
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

            <main className="dashboard-main">
                <aside className="dashboard-sidebar">
                    <h3>Welcome!</h3>
                    <ul>
                        <li><button onClick={() => navigate('/admin/dashboard')}>📋 Dashboard</button></li>
                        <li><button onClick={() => navigate('/admin/products')}>👕 Manage Products</button></li>
                        <li><button onClick={() => navigate('/admin/orders')}>📦 Orders Status</button></li>
                        <li><button onClick={() => navigate('/admin/customers')}>🧑 Users</button></li>
                        <li><button onClick={() => navigate('/admin/discounts')}>🔖 Discounts</button></li>
                        <li><button onClick={() => navigate('/admin/view-orders')} className="active">📨 View Orders</button></li>
                    </ul>
                </aside>

                <div className="dashboard-content">
                    <div className="controls-and-title">
                        <button onClick={() => navigate('/admin/orders')} className="secondary">← Back to Orders</button>
                        <h1>Order #{order.orderNumber || order._id?.substring(0, 8)}</h1>
                    </div>
                    <p>Detailed view of the order, customer, and purchased items.</p>

                    {error && (
                        <div className="error-message">
                            ❌ {error}
                        </div>
                    )}

                    <div className="order-details-grid">
                        <div className="col-left">
                            <div className="detail-card">
                                <h3 className="card-title">Order Summary</h3>
                                <div className="summary-line">
                                    <span>Status:</span>
                                    <span className={getStatusBadgeClass(order.status)}>
                                        {order.status || 'Unknown'}
                                    </span>
                                </div>
                                <div className="summary-line">
                                    <span>Order Date:</span>
                                    <span>{order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div className="summary-line">
                                    <span>Payment:</span>
                                    <span>{order.paymentMethod || 'Not specified'}</span>
                                </div>
                                <div className="summary-line">
                                    <span>Subtotal:</span>
                                    <span>₱{order.subtotal || order.total || 0}</span>
                                </div>
                                {order.discountAmount > 0 && (
                                    <div className="summary-line">
                                        <span>Discount:</span>
                                        <span>-₱{order.discountAmount}</span>
                                    </div>
                                )}
                                <div className="summary-line total">
                                    <span>Total:</span>
                                    <span>₱{order.total || 0}</span>
                                </div>
                            </div>

                            {/* FIXED: Payment Proof Section */}
                            <div className="detail-card">
                                <h3 className="card-title">Payment Proof</h3>
                                {order.paymentProof ? (
                                    <div className="payment-proof-section">
                                        <div className="proof-image-container">
                                            <img 
                                                src={order.paymentProof} 
                                                alt="Payment Proof" 
                                                className="proof-image"
                                                onError={(e) => handleImageError(e, 'payment proof')}
                                                onLoad={() => console.log('✅ Payment proof image loaded successfully:', order.paymentProof)}
                                            />
                                        </div>
                                        <div className="proof-details">
                                            <div className="proof-info">
                                                <strong>Payment Method:</strong> {order.paymentMethod || 'Not specified'}
                                            </div>
                                            <div className="proof-info">
                                                <strong>Uploaded:</strong> {order.paymentProofUploadedAt ? new Date(order.paymentProofUploadedAt).toLocaleString() : 'N/A'}
                                            </div>
                                            <div className="proof-actions">
                                                <a 
                                                    href={order.paymentProof} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="view-proof-btn"
                                                >
                                                    🔍 View Full Size
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="no-proof">
                                        <p>No payment proof uploaded yet.</p>
                                        <small>Customer will upload proof after completing payment.</small>
                                    </div>
                                )}
                            </div>

                            <div className="detail-card">
                                <h3 className="card-title">Customer Information</h3>
                                <div className="summary-line">
                                    <span>Name:</span>
                                    <span>{order.username || order.name || order.customerName || 'N/A'}</span>
                                </div>
                                <div className="summary-line">
                                    <span>Email:</span>
                                    <span>{order.email || 'N/A'}</span>
                                </div>
                                <div className="summary-line">
                                    <span>Phone:</span>
                                    <span>{order.phone || 'N/A'}</span>
                                </div>
                                <div className="summary-line">
                                    <span>User ID:</span>
                                    <span>{order.userId || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="detail-card">
                                <h3 className="card-title">Shipping Address</h3>
                                <div className="address-info">
                                    <p>{parseShippingAddress(order.shippingAddress)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="col-right">
                            <div className="detail-card">
                                <h3 className="card-title">Order Items</h3>
                                <div className="order-items-list">
                                    {order.items && order.items.length > 0 ? (
                                        order.items.map((item, index) => (
                                            <div key={index} className="order-item-row">
                                                <div className="item-image">
                                                    <img 
                                                        src={item.image} 
                                                        alt={item.name}
                                                        onError={(e) => handleImageError(e, 'product')}
                                                        onLoad={() => console.log('✅ Product image loaded successfully:', item.image)}
                                                    />
                                                </div>
                                                <div className="item-details">
                                                    <h4>{item.name}</h4>
                                                    <p className="item-price">₱{item.price || item.unitPrice || 0}</p>
                                                    <p className="item-quantity">Quantity: {item.qty || item.quantity || 1}</p>
                                                    <p className="item-subtotal">
                                                        Subtotal: ₱{((item.price || item.unitPrice || 0) * (item.qty || item.quantity || 1)).toFixed(2)}
                                                    </p>
                                                    {item.condition && (
                                                        <p className="item-condition">Condition: {item.condition}</p>
                                                    )}
                                                    {item.size && (
                                                        <p className="item-size">Size: {item.size}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p>No items found in this order.</p>
                                    )}
                                </div>
                            </div>

                            {/* Order Status Management */}
                            <div className="detail-card">
                                <h3 className="card-title">Update Order Status</h3>
                                <div className="status-controls">
                                    <p className="status-info">
                                        Current status: <strong className={getStatusBadgeClass(order.status)}>
                                            {order.status || 'Unknown'}
                                        </strong>
                                    </p>
                                    
                                    <div className="status-buttons">
                                        <button 
                                            onClick={() => updateOrderStatus('pending_payment')}
                                            disabled={order.status === 'pending_payment'}
                                            className={`status-btn ${order.status === 'pending_payment' ? 'active' : ''}`}
                                        >
                                            💳 Pending Payment
                                        </button>
                                        <button 
                                            onClick={() => updateOrderStatus('confirmed')}
                                            disabled={order.status === 'confirmed'}
                                            className={`status-btn ${order.status === 'confirmed' ? 'active' : ''}`}
                                        >
                                            ✅ Confirmed
                                        </button>
                                        <button 
                                            onClick={() => updateOrderStatus('processing')}
                                            disabled={order.status === 'processing'}
                                            className={`status-btn ${order.status === 'processing' ? 'active' : ''}`}
                                        >
                                            🔄 Processing
                                        </button>
                                        <button 
                                            onClick={() => updateOrderStatus('shipped')}
                                            disabled={order.status === 'shipped'}
                                            className={`status-btn ${order.status === 'shipped' ? 'active' : ''}`}
                                        >
                                            🚚 Shipped
                                        </button>
                                        <button 
                                            onClick={() => updateOrderStatus('completed')}
                                            disabled={order.status === 'completed'}
                                            className={`status-btn ${order.status === 'completed' ? 'active' : ''}`}
                                        >
                                            🎉 Completed
                                        </button>
                                    </div>
                                    
                                    <div className="status-note">
                                        <p><strong>Note:</strong> Update status based on payment verification and shipping progress.</p>
                                        {order.paymentProof && (
                                            <div className="payment-proof-info">
                                                <p>✅ Payment proof submitted by customer</p>
                                                <p>Please verify the payment proof before confirming the order.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Order Timeline */}
                            <div className="detail-card">
                                <h3 className="card-title">Order Timeline</h3>
                                <div className="timeline">
                                    <div className={`timeline-item ${['pending_payment', 'confirmed', 'processing', 'shipped', 'completed'].includes(order.status) ? 'completed' : ''}`}>
                                        <div className="timeline-marker">1</div>
                                        <div className="timeline-content">
                                            <strong>Order Placed</strong>
                                            <span>{order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className={`timeline-item ${order.paymentProof ? 'completed' : ''}`}>
                                        <div className="timeline-marker">2</div>
                                        <div className="timeline-content">
                                            <strong>Payment Proof Uploaded</strong>
                                            <span>
                                                {order.paymentProof 
                                                    ? `Uploaded at ${order.paymentProofUploadedAt ? new Date(order.paymentProofUploadedAt).toLocaleString() : 'N/A'}`
                                                    : 'Waiting for payment proof'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`timeline-item ${['confirmed', 'processing', 'shipped', 'completed'].includes(order.status) ? 'completed' : ''}`}>
                                        <div className="timeline-marker">3</div>
                                        <div className="timeline-content">
                                            <strong>Payment Verified</strong>
                                            <span>Payment verified and order confirmed</span>
                                        </div>
                                    </div>
                                    <div className={`timeline-item ${['processing', 'shipped', 'completed'].includes(order.status) ? 'completed' : ''}`}>
                                        <div className="timeline-marker">4</div>
                                        <div className="timeline-content">
                                            <strong>Processing</strong>
                                            <span>Preparing for shipment</span>
                                        </div>
                                    </div>
                                    <div className={`timeline-item ${['shipped', 'completed'].includes(order.status) ? 'completed' : ''}`}>
                                        <div className="timeline-marker">5</div>
                                        <div className="timeline-content">
                                            <strong>Shipped</strong>
                                            <span>Order shipped to customer</span>
                                        </div>
                                    </div>
                                    <div className={`timeline-item ${order.status === 'completed' ? 'completed' : ''}`}>
                                        <div className="timeline-marker">6</div>
                                        <div className="timeline-content">
                                            <strong>Completed</strong>
                                            <span>
                                                {order.status === 'completed' 
                                                    ? `Order completed`
                                                    : 'Waiting for completion'
                                                }
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <AdminFooter/>
        </div>
    );
}

export default AdminViewOrders;