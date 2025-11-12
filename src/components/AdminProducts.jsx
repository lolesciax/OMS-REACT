import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminFooter from './AdminFooter';

function AdminProducts() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [categories, setCategories] = useState([
        'Nike', 'Adidas', 'H&M', 'Zara', 'Uniqlo', 'Levi\'s', 'Gucci', 'Puma',
        'Under Armour', 'Forever 21', 'Gap', 'Old Navy', 'Tommy Hilfiger', 'Calvin Klein'
    ]);
    const [newCategory, setNewCategory] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price: '',
        stock: '',
        condition: 'Good',
        description: '',
        size: '',
        material: '',
        image: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // Material options for dropdown
    const materialOptions = [
        'Cotton',
        'Polyester',
        'Cotton-Polyester Blend',
        'Denim',
        'Wool',
        'Silk',
        'Nylon',
        'Leather',
        'Canvas',
        'Corduroy',
    ];

    useEffect(() => {
        checkAdminAccess();
        fetchProducts();
        loadCategories();
    }, []);

    const checkAdminAccess = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.isAdmin) {
            navigate('/shopping');
        }
    };

    const loadCategories = () => {
        const savedCategories = localStorage.getItem('productCategories');
        if (savedCategories) {
            setCategories(JSON.parse(savedCategories));
        }
    };

    const saveCategories = (updatedCategories) => {
        setCategories(updatedCategories);
        localStorage.setItem('productCategories', JSON.stringify(updatedCategories));
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/api/products');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.products || !Array.isArray(data.products)) {
                console.error('❌ Invalid products data:', data);
                setProducts([]);
                return;
            }

            // Process products to ensure proper image URLs - FIXED: Better image URL handling
            const processedProducts = data.products.map((product) => {
                let imageUrl = product.image;

                // Case 1: Image is already a full URL
                if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
                    // Use as is
                }
                // Case 2: Image is a relative path starting with /static/uploads/
                else if (imageUrl && imageUrl.startsWith('/static/uploads/')) {
                    imageUrl = `http://localhost:5000${imageUrl}`;
                }
                // Case 3: Image is a relative path starting with /
                else if (imageUrl && imageUrl.startsWith('/')) {
                    imageUrl = `http://localhost:5000${imageUrl}`;
                }
                // Case 4: Image is just a filename
                else if (imageUrl && !imageUrl.includes('/') && imageUrl.includes('.')) {
                    imageUrl = `http://localhost:5000/static/uploads/${imageUrl}`;
                }
                // Case 5: No image or invalid image data
                else {
                    imageUrl = 'http://localhost:5000/static/uploads/default-product.jpg';
                }

                return {
                    ...product,
                    image: imageUrl
                };
            });

            setProducts(processedProducts);

        } catch (error) {
            console.error('❌ Error fetching products:', error);
            setError('Failed to load products. Please check if the backend is running.');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError(null);
            setSuccess(null);

            // Validate required fields
            if (!formData.name.trim() || !formData.category.trim() || !formData.price || !formData.stock) {
                throw new Error('Please fill in all required fields');
            }

            // Create FormData for file upload
            const form = new FormData();
            form.append('name', formData.name.trim());
            form.append('category', formData.category.trim());
            form.append('price', parseFloat(formData.price));
            form.append('stock', parseInt(formData.stock));
            form.append('condition', formData.condition);
            form.append('description', formData.description.trim());
            form.append('size', formData.size.trim());
            form.append('material', formData.material.trim());

            // Append image if selected - FIXED: Don't require image for edits
            if (formData.image && formData.image instanceof File) {
                form.append('image', formData.image);
            } else if (!editingProduct && !formData.image) {
                // Only require image for new products
                throw new Error('Please select an image for the product');
            }

            const url = editingProduct
                ? `http://localhost:5000/api/products/${editingProduct._id}`
                : 'http://localhost:5000/api/products';

            const method = editingProduct ? 'PUT' : 'POST';

            console.log('📤 Submitting product form...');
            const response = await fetch(url, {
                method,
                body: form,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `HTTP error ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Product saved successfully:', result);

            setShowModal(false);
            resetForm();
            await fetchProducts();

            setSuccess(editingProduct ? 'Product updated successfully!' : 'Product added successfully!');
            setTimeout(() => setSuccess(null), 3000);

        } catch (error) {
            console.error('❌ Error saving product:', error);
            setError(error.message || 'Error saving product. Please try again.');
        }
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            category: product.category,
            price: product.price.toString(),
            stock: product.stock.toString(),
            condition: product.condition || 'Good',
            description: product.description || '',
            size: product.size || '',
            material: product.material || '',
            image: null,
        });
        setImagePreview(product.image || null);
        setShowModal(true);
        setError(null);
    };

    const handleDelete = async (productId) => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            try {
                setError(null);
                const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }

                await fetchProducts();
                setSuccess('Product deleted successfully!');
                setTimeout(() => setSuccess(null), 3000);

            } catch (error) {
                console.error('❌ Error deleting product:', error);
                setError(error.message || 'Error deleting product. Please try again.');
            }
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setError('Please select a valid image file');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                setError('Image size should be less than 5MB');
                return;
            }

            setFormData({ ...formData, image: file });
            setError(null);

            const reader = new FileReader();
            reader.onload = (event) => {
                setImagePreview(event.target.result);
            };
            reader.onerror = () => {
                setError('Failed to load image preview');
            };
            reader.readAsDataURL(file);
        } else {
            setFormData({ ...formData, image: null });
            setImagePreview(null);
        }
    };

    const handleAddCategory = () => {
        if (newCategory.trim() && !categories.includes(newCategory.trim())) {
            const updatedCategories = [...categories, newCategory.trim()];
            saveCategories(updatedCategories);
            setNewCategory('');
            setShowCategoryModal(false);
            setSuccess(`Category "${newCategory.trim()}" added successfully!`);
            setTimeout(() => setSuccess(null), 3000);
        }
    };

    const handleDeleteCategory = (categoryToDelete) => {
        if (window.confirm(`Are you sure you want to delete the category "${categoryToDelete}"?`)) {
            const updatedCategories = categories.filter(cat => cat !== categoryToDelete);
            saveCategories(updatedCategories);
            setSuccess(`Category "${categoryToDelete}" deleted successfully!`);
            setTimeout(() => setSuccess(null), 3000);
        }
    };

    const resetForm = () => {
        setEditingProduct(null);
        setFormData({
            name: '',
            category: '',
            price: '',
            stock: '',
            condition: 'Good',
            description: '',
            size: '',
            material: '',
            image: null,
        });
        setImagePreview(null);
        setError(null);
    };

    const handleModalClose = () => {
        setShowModal(false);
        resetForm();
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="dashboard">
            {/* FIXED HEADER */}
            <header className="header">
                <div className="header-left">
                    <div className="logo">
                        <img src="/Shop Icon.jpg" alt="Logo" />
                        <h2>Old Goods <span>Thrift</span></h2>
                    </div>
                </div>
                <div className="header-right">
                    <button onClick={() => navigate('/shopping')} className="view-store-btn">
                        🛍️ View Store
                    </button>
                    <button onClick={handleLogout} className="help-link">Logout</button>
                </div>
            </header>

            <main className="dashboard-main">
                {/* FIXED SIDEBAR */}
                <aside className="dashboard-sidebar">
                    <h3>Welcome!</h3>
                    <ul>
                        <li><button onClick={() => navigate('/admin/dashboard')} className="sidebar-btn">📋 Dashboard</button></li>
                        <li><button onClick={() => navigate('/admin/products')} className="sidebar-btn active">👕 Manage Products</button></li>
                        <li><button onClick={() => navigate('/admin/orders')} className="sidebar-btn">📦 Orders Status</button></li>
                        <li><button onClick={() => navigate('/admin/customers')} className="sidebar-btn">🧑 Users</button></li>
                        <li><button onClick={() => navigate('/admin/discounts')} className="sidebar-btn">🔖 Discounts</button></li>
                        <li><button onClick={() => navigate('/admin/view-orders')} className="sidebar-btn">📨 View Orders</button></li>
                    </ul>
                </aside>

                {/* MAIN CONTENT */}
                <section className="dashboard-content">
                    {/* CONTENT HEADER WITH TITLE AND BUTTONS */}
                    <div className="content-header">
                        <div className="content-title">
                            <h1>Products Management</h1>
                            <p>Manage your shop's products — add, edit, or remove items below.</p>
                        </div>
                        <div className="content-actions">
                            <button onClick={() => setShowModal(true)} className="primary">+ Add Product</button>
                            <button onClick={() => setShowCategoryModal(true)} className="secondary">
                                🏷️ Manage Categories
                            </button>
                            <button onClick={fetchProducts} className="secondary">
                                🔄 Refresh
                            </button>
                        </div>
                    </div>

                    {success && <div className="success-message">✅ {success}</div>}
                    {error && <div className="error-message">❌ {error}</div>}

                    <div className="table-wrap">
                        {loading ? (
                            <div className="loading-state">
                                <p>Loading products...</p>
                            </div>
                        ) : (
                            <table className="product-table">
                                <thead>
                                    <tr>
                                        <th>Image</th>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Price</th>
                                        <th>Stock</th>
                                        <th>Size</th>
                                        <th>Material</th>
                                        <th>Condition</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => (
                                        <tr key={product._id}>
                                            <td>
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="product-image"
                                                    onError={(e) => {
                                                        e.target.src = 'http://localhost:5000/static/uploads/default-product.jpg';
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <strong>{product.name}</strong>
                                                {product.description && (
                                                    <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>
                                                        {product.description.length > 50
                                                            ? `${product.description.substring(0, 50)}...`
                                                            : product.description}
                                                    </small>
                                                )}
                                            </td>
                                            <td>
                                                <span className="category-badge">
                                                    {product.category}
                                                </span>
                                            </td>
                                            <td>₱{product.price}</td>
                                            <td>{product.stock}</td>
                                            <td>
                                                <span className="size-badge">
                                                    {product.size || 'N/A'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="material-badge">
                                                    {product.material || 'N/A'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`condition-badge condition-${product.condition?.toLowerCase().replace(' ', '')}`}>
                                                    {product.condition}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button onClick={() => handleEdit(product)} className="edit-btn">Edit</button>
                                                    <button onClick={() => handleDelete(product._id)} className="delete-btn">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {products.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="no-products">
                                                No products found. Add your first product!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>

            {/* ADD/EDIT PRODUCT MODAL */}
            {showModal && (
                <div className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
                            <button className="modal-close" onClick={handleModalClose}>×</button>
                        </div>

                        {error && <div className="error-message">❌ {error}</div>}

                        <form onSubmit={handleSubmit} className="product-form">
                            <div className="form-section">
                                <h3>Basic Information</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Product Name *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Enter product name"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Category *</label>
                                        <div className="select-with-action">
                                            <select
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map((category) => (
                                                    <option key={category} value={category}>
                                                        {category}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="add-category-btn"
                                                onClick={() => setShowCategoryModal(true)}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Price (₱) *</label>
                                        <input
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            placeholder="Enter price"
                                            min="0"
                                            step="0.01"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Stock *</label>
                                        <input
                                            type="number"
                                            value={formData.stock}
                                            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                            placeholder="Enter stock quantity"
                                            min="0"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Specifications</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Size</label>
                                        <select
                                            value={formData.size}
                                            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                                        >
                                            <option value="">Select Size</option>
                                            <option value="XS">XS</option>
                                            <option value="S">S</option>
                                            <option value="M">M</option>
                                            <option value="L">L</option>
                                            <option value="XL">XL</option>
                                            <option value="XXL">XXL</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Material</label>
                                        <select
                                            value={formData.material}
                                            onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                                        >
                                            <option value="">Select Material</option>
                                            {materialOptions.map((material) => (
                                                <option key={material} value={material}>
                                                    {material}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Condition</label>
                                    <select
                                        value={formData.condition}
                                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                                    >
                                        <option value="Excellent">Excellent</option>
                                        <option value="Very Good">Very Good</option>
                                        <option value="Good">Good</option>
                                        <option value="Fair">Fair</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Description & Image</h3>
                                <div className="form-group">
                                    <label>Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Enter product description"
                                        rows="3"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Product Image {!editingProduct && '*'}</label>
                                    <input
                                        type="file"
                                        onChange={handleImageChange}
                                        accept="image/*"
                                        key={editingProduct ? `edit-${editingProduct._id}` : 'add-new'}
                                    />
                                    <small className="file-help">Accepted formats: JPG, PNG, WEBP. Max size: 5MB</small>
                                    {imagePreview && (
                                        <div className="image-preview">
                                            <img src={imagePreview} alt="Preview" />
                                            <small>Image Preview</small>
                                        </div>
                                    )}
                                    {editingProduct && !imagePreview && (
                                        <div className="image-preview">
                                            <img src={editingProduct.image} alt="Current" />
                                            <small>Current Image</small>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={handleModalClose} className="secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="primary">
                                    {editingProduct ? 'Update Product' : 'Add Product'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANAGE CATEGORIES MODAL */}
            {showCategoryModal && (
                <div className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Manage Categories</h2>
                            <button className="modal-close" onClick={() => setShowCategoryModal(false)}>×</button>
                        </div>

                        <div className="modal-body">
                            <div className="add-category-section">
                                <h3>Add New Category</h3>
                                <div className="add-category-form">
                                    <input
                                        type="text"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        placeholder="Enter new category name"
                                        className="category-input"
                                    />
                                    <button
                                        onClick={handleAddCategory}
                                        className="primary"
                                        disabled={!newCategory.trim()}
                                    >
                                        Add Category
                                    </button>
                                </div>
                            </div>

                            <div className="categories-list-section">
                                <h3>Categories ({categories.length})</h3>
                                <div className="categories-list">
                                    {categories.map((category, index) => (
                                        <div key={category} className="category-item">
                                            <span className="category-name">{category}</span>
                                            <button
                                                onClick={() => handleDeleteCategory(category)}
                                                className="delete-category-btn"
                                                disabled={categories.length <= 1}
                                                title={categories.length <= 1 ? "Cannot delete the last category" : `Delete ${category}`}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button
                                type="button"
                                onClick={() => setShowCategoryModal(false)}
                                className="primary"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AdminFooter/>
        </div>
    );
}

export default AdminProducts;