import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/admin/discount.css';
import AdminFooter from './AdminFooter';

function AdminDiscounts() {
    const navigate = useNavigate();
    const [discounts, setDiscounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        discountType: 'percentage',
        value: '',
        minPurchase: '',
        validUntil: '',
        category: '',
        applyTo: 'all' // 'all' or 'category'
    });

    useEffect(() => {
        checkAdminAccess();
        fetchDiscounts();
        fetchCategoriesFromProducts();
    }, []);

    const checkAdminAccess = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.isAdmin) {
            navigate('/shopping');
        }
    };

    const fetchDiscounts = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/api/admin/discounts');
            const data = await response.json();
            setDiscounts(data.discounts || []);
        } catch (error) {
            console.error('Error fetching discounts:', error);
            setDiscounts([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategoriesFromProducts = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/products');
            const data = await response.json();
            
            if (data.success && data.products) {
                // Extract unique categories from products
                const uniqueCategories = [...new Set(data.products
                    .filter(product => product.category && product.category.trim() !== '')
                    .map(product => product.category)
                )].sort();
                
                setCategories(uniqueCategories);
                console.log('Fetched categories from products:', uniqueCategories);
            } else {
                console.error('Failed to fetch products:', data.message);
                setCategories([]);
            }
        } catch (error) {
            console.error('Error fetching categories from products:', error);
            // Fallback: Try the categories endpoint
            fetchCategoriesFallback();
        }
    };

    const fetchCategoriesFallback = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/products/categories');
            const data = await response.json();
            if (data.success) {
                setCategories(data.categories || []);
            } else {
                setCategories([]);
            }
        } catch (error) {
            console.error('Error fetching categories from fallback endpoint:', error);
            setCategories([]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate form data
        if (formData.applyTo === 'category' && !formData.category) {
            alert('Please select a category');
            return;
        }

        if (formData.discountType === 'percentage' && (formData.value < 0 || formData.value > 100)) {
            alert('Percentage value must be between 0 and 100');
            return;
        }

        if (formData.discountType === 'fixed' && formData.value < 0) {
            alert('Fixed amount must be greater than 0');
            return;
        }

        try {
            const response = await fetch('http://localhost:5000/api/admin/discounts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                setShowModal(false);
                setFormData({ 
                    code: '', 
                    discountType: 'percentage', 
                    value: '', 
                    minPurchase: '', 
                    validUntil: '',
                    category: '',
                    applyTo: 'all'
                });
                fetchDiscounts();
                alert('Discount created successfully!');
            } else {
                alert(result.message || 'Error creating discount. Please try again.');
            }
        } catch (error) {
            console.error('Error creating discount:', error);
            alert('Error creating discount. Please try again.');
        }
    };

    const handleDelete = async (discountId) => {
        if (window.confirm('Are you sure you want to delete this discount?')) {
            try {
                const response = await fetch(`http://localhost:5000/api/admin/discounts/${discountId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    fetchDiscounts();
                    alert('Discount deleted successfully!');
                } else {
                    alert('Error deleting discount. Please try again.');
                }
            } catch (error) {
                console.error('Error deleting discount:', error);
                alert('Error deleting discount. Please try again.');
            }
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    const getDiscountScope = (discount) => {
        if (discount.applyTo === 'category' && discount.category) {
            return `Category: ${discount.category}`;
        }
        return 'All Products';
    };

    const formatCategoryName = (category) => {
        return category
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
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
                    <button onClick={handleLogout} className="logout-btn">Logout</button>
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
                        <li><button onClick={() => navigate('/admin/discounts')} className="active">🔖 Discounts</button></li>
                        <li><button onClick={() => navigate('/admin/view-orders')}>📨 View Orders</button></li>
                    </ul>
                </aside>

                <section className="dashboard-content">
                    <h1>Discounts Management 🎉</h1>
                    <p>Create and manage discount codes for all products or specific categories.</p>

                    <div className="product-controls">
                        <button onClick={() => setShowModal(true)} className="primary-btn">+ Create Discount</button>
                    </div>

                    {loading ? (
                        <div className="loading-state">
                            <p>Loading discounts...</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table className="product-table">
                                <thead>
                                    <tr>
                                        <th>Discount Code</th>
                                        <th>Type</th>
                                        <th>Value</th>
                                        <th>Min Purchase</th>
                                        <th>Valid Until</th>
                                        <th>Scope</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {discounts.map(discount => (
                                        <tr key={discount._id}>
                                            <td><strong>{discount.code}</strong></td>
                                            <td className="discount-type">{discount.discountType}</td>
                                            <td className="discount-value">
                                                {discount.discountType === 'percentage' ? 
                                                    `${discount.value}%` : `₱${discount.value}`
                                                }
                                            </td>
                                            <td>{discount.minPurchase ? `₱${discount.minPurchase}` : 'None'}</td>
                                            <td>{new Date(discount.validUntil).toLocaleDateString()}</td>
                                            <td>
                                                <span className="scope-badge">
                                                    {getDiscountScope(discount)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="delete-btn" onClick={() => handleDelete(discount._id)}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {discounts.length === 0 && (
                                        <tr>
                                            <td colSpan="7" className="no-data">
                                                No discounts found. Create your first discount code!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>

            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h2>Create Discount Code</h2>
                            <button 
                                className="close-btn"
                                onClick={() => {
                                    setShowModal(false);
                                    setFormData({ 
                                        code: '', 
                                        discountType: 'percentage', 
                                        value: '', 
                                        minPurchase: '', 
                                        validUntil: '',
                                        category: '',
                                        applyTo: 'all'
                                    });
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="discountCode">Discount Code *</label>
                                    <input 
                                        type="text" 
                                        id="discountCode"
                                        value={formData.code}
                                        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                        placeholder="e.g., SUMMER25" 
                                        required
                                        pattern="[A-Z0-9]+"
                                        title="Only uppercase letters and numbers allowed"
                                    />
                                </div>
                                
                                <div className="form-group">
                                    <label htmlFor="discountType">Discount Type *</label>
                                    <select 
                                        id="discountType"
                                        value={formData.discountType}
                                        onChange={(e) => setFormData({...formData, discountType: e.target.value})}
                                    >
                                        <option value="percentage">Percentage</option>
                                        <option value="fixed">Fixed Amount</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="discountValue">
                                        {formData.discountType === 'percentage' ? 'Percentage Value *' : 'Fixed Amount *'}
                                    </label>
                                    <input 
                                        type="number" 
                                        id="discountValue"
                                        value={formData.value}
                                        onChange={(e) => setFormData({...formData, value: e.target.value})}
                                        placeholder={formData.discountType === 'percentage' ? 'e.g., 25' : 'e.g., 100'} 
                                        required
                                        min="0"
                                        max={formData.discountType === 'percentage' ? '100' : ''}
                                        step={formData.discountType === 'percentage' ? '1' : '0.01'}
                                    />
                                    {formData.discountType === 'percentage' && (
                                        <small className="input-hint">Enter a value between 0-100</small>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="minPurchase">Minimum Purchase (Optional)</label>
                                    <input 
                                        type="number" 
                                        id="minPurchase"
                                        value={formData.minPurchase}
                                        onChange={(e) => setFormData({...formData, minPurchase: e.target.value})}
                                        placeholder="e.g., 500" 
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="applyTo">Apply To *</label>
                                <select 
                                    id="applyTo"
                                    value={formData.applyTo}
                                    onChange={(e) => setFormData({...formData, applyTo: e.target.value})}
                                >
                                    <option value="all">All Products</option>
                                    <option value="category">Specific Category</option>
                                </select>
                            </div>

                            {formData.applyTo === 'category' && (
                                <div className="form-group">
                                    <label htmlFor="category">Select Category *</label>
                                    <select 
                                        id="category"
                                        value={formData.category}
                                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                                        required={formData.applyTo === 'category'}
                                    >
                                        <option value="">Select a category</option>
                                        {categories.map(category => (
                                            <option key={category} value={category}>
                                                {formatCategoryName(category)}
                                            </option>
                                        ))}
                                    </select>
                                    {categories.length === 0 && (
                                        <small className="input-hint error">
                                            No categories found. Please add products with categories first.
                                        </small>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="validUntil">Valid Until *</label>
                                <input 
                                    type="date" 
                                    id="validUntil"
                                    value={formData.validUntil}
                                    onChange={(e) => setFormData({...formData, validUntil: e.target.value})}
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>

                            <div className="modal-actions">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowModal(false);
                                        setFormData({ 
                                            code: '', 
                                            discountType: 'percentage', 
                                            value: '', 
                                            minPurchase: '', 
                                            validUntil: '',
                                            category: '',
                                            applyTo: 'all'
                                        });
                                    }}
                                    className="secondary-btn"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="primary-btn"
                                    disabled={formData.applyTo === 'category' && categories.length === 0}
                                >
                                    Create Discount
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

export default AdminDiscounts;