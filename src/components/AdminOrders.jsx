import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminFooter from './AdminFooter';

function AdminOrders() {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAdminAccess();
        fetchOrders();
    }, []);

    const checkAdminAccess = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.isAdmin) {
            navigate('/shopping');
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/admin/orders');
            const data = await response.json();
            if (data.success) {
                setOrders(data.orders || []);
            } else {
                console.error('Error fetching orders:', data.error);
                setOrders([]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                fetchOrders();
                alert('Order status updated successfully!');
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Error updating order status.');
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status.');
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const getStatusBadgeClass = (status) => {
        return `status-badge status-${status.toLowerCase()}`;
    };

    const formatOrderId = (orderId, orderNumber) => {
        if (orderNumber) return orderNumber;
        if (!orderId) return 'N/A';
        return `ORD-${orderId.substring(18, 24).toUpperCase()}`;
    };

    const getCustomerName = (order) => {
        // Try customerName first, then username, then fallback
        return order.customerName || order.username || 'Customer';
    };

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
                        <li><button onClick={() => navigate('/admin/orders')} className="active">📦 Orders Status</button></li>
                        <li><button onClick={() => navigate('/admin/customers')}>🧑 Users</button></li>
                        <li><button onClick={() => navigate('/admin/discounts')}>🔖 Discounts</button></li>
                        <li><button onClick={() => navigate('/admin/view-orders')}>📨 View Orders</button></li>
                    </ul>
                </aside>

                <section className="dashboard-content">
                    <h1>Order Status</h1>
                    <p>Track all open and closed orders in your system.</p>

                    <div className="order-table-container">
                        <table className="order-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Customer Name</th>
                                    <th>Date</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                                            Loading orders...
                                        </td>
                                    </tr>
                                ) : orders.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>
                                            No orders found.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map(order => (
                                        <tr key={order._id}>
                                            <td>{formatOrderId(order._id, order.orderNumber)}</td>
                                            <td>{getCustomerName(order)}</td>
                                            <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                                            <td>₱{order.total?.toFixed(2)}</td>
                                            <td>
                                                <span className={getStatusBadgeClass(order.status)}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button 
                                                        onClick={() => navigate(`/admin/view-orders/${order._id}`)}
                                                        className="edit-btn"
                                                    >
                                                        View
                                                    </button>
                                                    <select 
                                                        value={order.status}
                                                        onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                                                        className="status-select"
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="confirmed">Confirmed</option>
                                                        <option value="processing">Processing</option>
                                                        <option value="shipped">Shipped</option>
                                                        <option value="completed">Completed</option>
                                                    </select>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            <AdminFooter/>
        </div>
    );
}

export default AdminOrders;