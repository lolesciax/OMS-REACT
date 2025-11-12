import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminFooter from './AdminFooter';

function AdminCustomers() {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        isAdmin: false,
        isActive: true
    });

    useEffect(() => {
        checkAdminAccess();
        fetchCustomers();
    }, []);

    const checkAdminAccess = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.isAdmin) {
            navigate('/shopping');
        }
    };

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('http://localhost:5000/api/admin/customers');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                let fetchedCustomers = data.customers || [];

                // ✅ Format userId and sort order
                fetchedCustomers = fetchedCustomers.map((user) => ({
                    ...user,
                    formattedId: user.user_id
                        ? user.user_id
                        : `USR-${String(user._id).slice(-6).toUpperCase()}`
                }));

                // ✅ Sort admin first, then customers by creation date
                fetchedCustomers.sort((a, b) => {
                    if (a.isAdmin && !b.isAdmin) return -1;
                    if (!a.isAdmin && b.isAdmin) return 1;
                    return new Date(a.created_at) - new Date(b.created_at);
                });

                setCustomers(fetchedCustomers);
            } else {
                throw new Error(data.error || 'Failed to fetch customers');
            }

        } catch (error) {
            console.error('Error fetching customers:', error);
            setError(error.message || 'Failed to load customers. Please check if the backend server is running.');
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            phone: '',
            isAdmin: false,
            isActive: true
        });
        setShowUserModal(true);
        setError(null);
    };

    const handleEditUser = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username || '',
            email: user.email || '',
            password: '', // Don't pre-fill password for security
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            phone: user.phone || '',
            isAdmin: user.isAdmin || false,
            isActive: user.isActive !== undefined ? user.isActive : true
        });
        setShowUserModal(true);
        setError(null);
    };

    const handleSubmitUser = async (e) => {
        e.preventDefault();
        try {
            setError(null);

            // Validate required fields
            if (!formData.username.trim() || !formData.email.trim()) {
                throw new Error('Username and email are required');
            }

            // For new users, password is required
            if (!editingUser && !formData.password.trim()) {
                throw new Error('Password is required for new users');
            }

            const userData = {
                username: formData.username.trim(),
                email: formData.email.trim(),
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                phone: formData.phone.trim(),
                isAdmin: formData.isAdmin,
                isActive: formData.isActive
            };

            // Only include password if provided (for new users or when changing password)
            if (formData.password.trim()) {
                userData.password = formData.password.trim();
            }

            const url = editingUser 
                ? `http://localhost:5000/api/admin/users/${editingUser._id}`
                : 'http://localhost:5000/api/admin/users';

            const method = editingUser ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            setShowUserModal(false);
            await fetchCustomers();

            alert(editingUser ? 'User updated successfully!' : 'User added successfully!');

        } catch (error) {
            console.error('Error saving user:', error);
            setError(error.message || 'Error saving user. Please try again.');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            try {
                setError(null);
                const response = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                await fetchCustomers();
                alert('User deleted successfully!');

            } catch (error) {
                console.error('Error deleting user:', error);
                setError(error.message || 'Error deleting user. Please try again.');
            }
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    };

    const getRoleBadge = (isAdmin) => {
        const role = isAdmin ? 'admin' : 'customer';
        const roleClass = isAdmin ? 'role-admin' : 'role-customer';
        return (
            <span className={`role-badge ${roleClass}`}>
                {role}
            </span>
        );
    };

    const getStatusBadge = (isActive) => {
        const status = isActive ? 'active' : 'inactive';
        return (
            <span className={`status-badge status-${status}`}>
                {isActive ? 'Active' : 'Inactive'}
            </span>
        );
    };

    const resetForm = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            email: '',
            password: '',
            firstName: '',
            lastName: '',
            phone: '',
            isAdmin: false,
            isActive: true
        });
    };

    const handleModalClose = () => {
        setShowUserModal(false);
        resetForm();
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
                        <li><button onClick={() => navigate('/admin/orders')}>📦 Orders Status</button></li>
                        <li><button onClick={() => navigate('/admin/customers')} className="active">🧑 Users</button></li>
                        <li><button onClick={() => navigate('/admin/discounts')}>🔖 Discounts</button></li>
                        <li><button onClick={() => navigate('/admin/view-orders')}>📨 View Orders</button></li>
                    </ul>
                </aside>

                <section className="dashboard-content">
                    <div className="content-header">
                        <div className="content-title">
                            <h1>Users Management</h1>
                            <p>Manage and view your customer base. ({customers.length} users found)</p>
                        </div>
                        <div className="content-actions">
                            <button onClick={handleAddUser} className="primary">+ Add User</button>
                            <button onClick={fetchCustomers} className="secondary">🔄 Refresh</button>
                        </div>
                    </div>

                    {error && (
                        <div className="error-message">
                            ❌ {error}
                        </div>
                    )}

                    <div className="customer-table-container">
                        <table className="customer-table">
                            <thead>
                                <tr>
                                    <th>User ID</th>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Registered Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr className="empty-state">
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                            <div className="loading-spinner">Loading users...</div>
                                        </td>
                                    </tr>
                                ) : customers.length === 0 ? (
                                    <tr className="empty-state">
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                            {error ? 'Failed to load users' : 'No users found yet.'}
                                        </td>
                                    </tr>
                                ) : (
                                    customers.map((customer) => (
                                        <tr key={customer._id}>
                                            <td className="customer-id">{customer.formattedId}</td>
                                            <td>
                                                <div className="customer-info">
                                                    <strong>{customer.username || customer.name || 'N/A'}</strong>
                                                    {customer.phone && (
                                                        <small>📞 {customer.phone}</small>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{customer.email || 'N/A'}</td>
                                            <td>{getRoleBadge(customer.isAdmin)}</td>
                                            <td>{formatDate(customer.created_at)}</td>
                                            <td>{getStatusBadge(customer.isActive)}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <button 
                                                        onClick={() => handleEditUser(customer)} 
                                                        className="edit-btn"
                                                    >
                                                        Edit
                                                    </button>
                                                    {!customer.isAdmin && (
                                                        <button 
                                                            onClick={() => handleDeleteUser(customer._id)} 
                                                            className="delete-btn"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
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

            {/* Add/Edit User Modal */}
            {showUserModal && (
                <div className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
                            <button className="modal-close" onClick={handleModalClose}>×</button>
                        </div>

                        {error && <div className="error-message">❌ {error}</div>}

                        <form onSubmit={handleSubmitUser} className="product-form">
                            <div className="form-section">
                                <h3>Basic Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Username *</label>
                                        <input
                                            type="text"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            placeholder="Enter username"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="Enter email address"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>First Name</label>
                                        <input
                                            type="text"
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                            placeholder="Enter first name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name</label>
                                        <input
                                            type="text"
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                            placeholder="Enter last name"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Phone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="Enter phone number"
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Account Settings</h3>
                                <div className="form-group">
                                    <label>Password {!editingUser && '*'}</label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingUser ? "Leave blank to keep current password" : "Enter password"}
                                    />
                                    {editingUser && (
                                        <small className="file-help">Leave password blank to keep current password</small>
                                    )}
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={formData.isAdmin}
                                                onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                                            />
                                            Administrator Role
                                        </label>
                                        <small className="file-help">Admin users have full access to the admin panel</small>
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            />
                                            Active Account
                                        </label>
                                        <small className="file-help">Inactive users cannot log in</small>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={handleModalClose} className="secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="primary">
                                    {editingUser ? 'Update User' : 'Add User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <AdminFooter/>
        </div>
    );
}

export default AdminCustomers;