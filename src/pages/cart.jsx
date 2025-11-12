import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/cart.css';
import Footer from '../components/Footer';

const SHIPPING_FEE = 50;

// Reusable Cart Item Component
const CartItem = ({ item, updateItem, removeItem }) => {
    // Ensure price is a number
    const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
    
    const handleQtyChange = (e) => {
        const newQty = parseInt(e.target.value);
        if (newQty >= 1 && newQty <= item.currentStock) {
            updateItem(item.id, { qty: newQty });
        } else if (newQty > item.currentStock) {
            alert(`Only ${item.currentStock} items available for ${item.name}`);
        }
    };

    const handleQtyAdjust = (change) => {
        const newQty = item.qty + change;
        if (newQty >= 1 && newQty <= item.currentStock) {
            updateItem(item.id, { qty: newQty });
        } else if (newQty > item.currentStock) {
            alert(`Only ${item.currentStock} items available for ${item.name}`);
        }
    };
    
    const handleSelectChange = (e) => {
        // Only allow selection if item is in stock
        if (item.currentStock > 0) {
            updateItem(item.id, { selected: e.target.checked });
        }
    };

    // Check if item is out of stock
    const isOutOfStock = item.currentStock === 0;
    const maxQuantity = Math.min(99, item.currentStock);

    return (
        <div className={`cart-item ${isOutOfStock ? 'out-of-stock' : ''}`} data-id={item.id} data-price={price}>
            <input 
                type="checkbox" 
                className="select-item"
                checked={item.selected && !isOutOfStock}
                onChange={handleSelectChange}
                disabled={isOutOfStock}
            />
            <img src={item.image} alt={item.name} /> 
            
            <div className="item-details">
                <h3>{item.name}</h3>
                <p className="condition">{item.condition}</p>
                <p className="price">₱{price.toFixed(2)}</p>
                <div className="stock-info">
                    {isOutOfStock ? (
                        <span className="out-of-stock-text">Out of Stock</span>
                    ) : (
                        <span className="stock-count">
                            Available: {item.currentStock}
                        </span>
                    )}
                </div>
                <p className="item-total">₱{(price * item.qty).toFixed(2)}</p>
            </div>
            
            <div className="item-actions">
                {!isOutOfStock ? (
                    <>
                        <div className="quantity-controls">
                            <button 
                                type="button" 
                                className="qty-btn"
                                onClick={() => handleQtyAdjust(-1)}
                                disabled={item.qty <= 1}
                            >
                                -
                            </button>
                            <input 
                                type="number" 
                                value={item.qty} 
                                min="1" 
                                max={maxQuantity}
                                className="item-qty"
                                onChange={handleQtyChange}
                            />
                            <button 
                                type="button" 
                                className="qty-btn"
                                onClick={() => handleQtyAdjust(1)}
                                disabled={item.qty >= maxQuantity}
                            >
                                +
                            </button>
                        </div>
                        <button 
                            type="button" 
                            className="remove-btn"
                            onClick={() => removeItem(item.id)}
                        >
                            Remove
                        </button>
                    </>
                ) : (
                    <div className="out-of-stock-actions">
                        <span className="out-of-stock-message">This item is no longer available</span>
                        <button 
                            type="button" 
                            className="remove-btn"
                            onClick={() => removeItem(item.id)}
                        >
                            Remove
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

function Cart() {
    const navigate = useNavigate();
    const [cart, setCart] = useState([]);
    const [summary, setSummary] = useState({ subtotal: 0, shipping: 0, total: 0 });
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastSaved, setLastSaved] = useState(null);

    // Load cart from database
    const loadCartFromDatabase = async (userId) => {
        try {
            const response = await fetch(`http://localhost:5000/api/cart/${userId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    console.log('🛒 Loaded cart from database:', data.cart);
                    return data.cart;
                }
            }
            console.log('❌ Failed to load cart from database');
            return [];
        } catch (error) {
            console.error('Error loading cart from database:', error);
            return [];
        }
    };

    // Update cart item in database
    const updateCartInDatabase = async (userId, productId, updateData) => {
        try {
            const response = await fetch(`http://localhost:5000/api/cart/${userId}/update`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_id: productId,
                    ...updateData
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.success;
            }
            return false;
        } catch (error) {
            console.error('Error updating cart in database:', error);
            return false;
        }
    };

    // Remove item from database cart
    const removeFromDatabase = async (userId, productId) => {
        try {
            const response = await fetch(`http://localhost:5000/api/cart/${userId}/remove`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_id: productId
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.success;
            }
            return false;
        } catch (error) {
            console.error('Error removing from database cart:', error);
            return false;
        }
    };

    // Load user and cart data
    useEffect(() => {
        const loadUserAndCart = async () => {
            try {
                setIsLoading(true);
                
                // Get user from localStorage
                const userData = localStorage.getItem('user');
                if (userData) {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);
                    
                    // Load user-specific cart from database
                    const userId = parsedUser.id || parsedUser.username;
                    const cartData = await loadCartFromDatabase(userId);
                    
                    // Sort items: available items first, then out of stock items
                    const sortedCart = cartData.sort((a, b) => {
                        if (a.currentStock > 0 && b.currentStock === 0) return -1;
                        if (a.currentStock === 0 && b.currentStock > 0) return 1;
                        return 0;
                    });
                    
                    console.log(`🛒 Loaded ${sortedCart.length} items from database for user ${userId}`);
                    setCart(sortedCart);
                    
                } else {
                    console.log('❌ No user found, redirecting to login');
                    navigate('/login');
                    return;
                }

            } catch (error) {
                console.error('Error loading user data:', error);
                setCart([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadUserAndCart();
    }, [navigate]);

    const removeItem = async (productId) => {
        if (user) {
            const success = await removeFromDatabase(user.id || user.username, productId);
            if (success) {
                setCart(prevCart => prevCart.filter(item => item.id !== productId));
            } else {
                alert('Failed to remove item from cart. Please try again.');
            }
        }
    };

    const updateItem = async (productId, newValues) => {
        if (user) {
            const success = await updateCartInDatabase(user.id || user.username, productId, newValues);
            if (success) {
                setCart(prevCart =>
                    prevCart.map(item => 
                        item.id === productId ? { ...item, ...newValues } : item
                    )
                );
                setLastSaved(new Date().toLocaleTimeString());
            } else {
                alert('Failed to update cart. Please check the quantity and try again.');
            }
        }
    };

    const toggleSelectAll = () => {
        const availableItems = cart.filter(item => item.currentStock > 0);
        const allSelected = availableItems.length > 0 && availableItems.every(item => item.selected);
        
        // Update all available items in database
        if (user) {
            availableItems.forEach(item => {
                updateCartInDatabase(user.id || user.username, item.id, { selected: !allSelected });
            });
        }
        
        setCart(prevCart =>
            prevCart.map(item => ({
                ...item,
                selected: item.currentStock > 0 ? !allSelected : false
            }))
        );
    };

    const removeSelectedItems = async () => {
        const selectedItems = cart.filter(item => item.selected);
        if (selectedItems.length === 0) {
            alert('Please select items to remove.');
            return;
        }
        
        if (window.confirm(`Remove ${selectedItems.length} selected item(s)?`)) {
            // Remove from database
            if (user) {
                const removePromises = selectedItems.map(item => 
                    removeFromDatabase(user.id || user.username, item.id)
                );
                
                const results = await Promise.all(removePromises);
                if (results.every(success => success)) {
                    setCart(prevCart => prevCart.filter(item => !item.selected));
                } else {
                    alert('Some items could not be removed. Please try again.');
                }
            }
        }
    };

    const removeOutOfStockItems = async () => {
        const outOfStockItems = cart.filter(item => item.currentStock === 0);
        if (outOfStockItems.length === 0) {
            alert('No out of stock items found in your cart.');
            return;
        }
        
        if (window.confirm(`Remove ${outOfStockItems.length} out of stock item(s)?`)) {
            // Remove from database
            if (user) {
                const removePromises = outOfStockItems.map(item => 
                    removeFromDatabase(user.id || user.username, item.id)
                );
                
                const results = await Promise.all(removePromises);
                if (results.every(success => success)) {
                    setCart(prevCart => prevCart.filter(item => item.currentStock > 0));
                } else {
                    alert('Some items could not be removed. Please try again.');
                }
            }
        }
    };

    const updateSummary = useCallback(() => {
        let subtotal = 0;
        let checkedCount = 0;

        cart.forEach(item => {
            if (item.selected && item.currentStock > 0) {
                // Ensure price is a number
                const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
                subtotal += price * item.qty;
                checkedCount++;
            }
        });

        const shipping = checkedCount > 0 ? SHIPPING_FEE : 0;
        const total = subtotal + shipping;

        setSummary({
            subtotal: subtotal,
            shipping: shipping,
            total: total,
        });
    }, [cart]);

    useEffect(() => {
        updateSummary();
    }, [cart, updateSummary]);

    const selectedItemsCount = cart.filter(item => item.selected && item.currentStock > 0).length;
    const outOfStockCount = cart.filter(item => item.currentStock === 0).length;
    const availableItems = cart.filter(item => item.currentStock > 0);
    const isAllSelected = availableItems.length > 0 && availableItems.every(item => item.selected);
    const isCheckoutDisabled = selectedItemsCount === 0;

    const handleCheckout = () => {
        if (isCheckoutDisabled) {
            alert('Please select at least one item to checkout.');
            return;
        }

        const selectedItems = cart.filter(item => item.selected && item.currentStock > 0);
        
        // Double-check stock availability before checkout
        const insufficientStockItems = selectedItems.filter(item => item.qty > item.currentStock);
        if (insufficientStockItems.length > 0) {
            alert('Some items in your cart have insufficient stock. Please adjust quantities before checkout.');
            return;
        }

        const checkoutData = {
            items: selectedItems.map(item => ({
                ...item,
                // Ensure price is a number for checkout
                price: typeof item.price === 'string' ? parseFloat(item.price) : item.price
            })),
            summary: summary,
            timestamp: new Date().toISOString(),
            userId: user?.id || user?.username
        };

        // Save checkout data for the checkout page
        localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
        
        // Navigate to checkout page
        navigate('/checkout');
    };

    if (!user) {
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
                    <h3>Please log in to view your cart</h3>
                    <Link to="/login" className="btn-primary">Log In</Link>
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
                <div className="header-right">
                    {lastSaved && (
                        <span className="last-saved">Last saved: {lastSaved}</span>
                    )}
                    <Link to="/shopping" className="back-link">Back to Shop</Link>
                </div>
            </header>

            {/* MAIN CART SECTION */}
            <main className="cart-container">
                <div className="cart-header">
                    <h2>My Shopping Cart ({cart.length} items)</h2>
                    {outOfStockCount > 0 && (
                        <div className="out-of-stock-notice">
                            <span>{outOfStockCount} item(s) out of stock</span>
                            <button 
                                className="remove-out-of-stock-btn"
                                onClick={removeOutOfStockItems}
                            >
                                Remove All
                            </button>
                        </div>
                    )}
                </div>

                {/* Cart Actions */}
                {cart.length > 0 && (
                    <div className="cart-actions">
                        <label className="select-all-label">
                            <input 
                                type="checkbox" 
                                checked={isAllSelected}
                                onChange={toggleSelectAll}
                                disabled={availableItems.length === 0}
                            />
                            Select All ({selectedItemsCount}/{availableItems.length} available)
                        </label>
                        <div className="cart-action-buttons">
                            <button 
                                type="button" 
                                className="remove-selected-btn"
                                onClick={removeSelectedItems}
                                disabled={selectedItemsCount === 0}
                            >
                                Remove Selected
                            </button>
                            {outOfStockCount > 0 && (
                                <button 
                                    type="button" 
                                    className="remove-out-of-stock-btn"
                                    onClick={removeOutOfStockItems}
                                >
                                    Remove Out of Stock ({outOfStockCount})
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <form className="cart-content"> 
                    
                    {/* LEFT SIDE - ITEMS */}
                    <div className="cart-items">
                        {isLoading ? (
                            <div className="loading">Loading cart...</div>
                        ) : cart.length > 0 ? (
                            <>
                                {cart.map(item => (
                                    <CartItem 
                                        key={item.id} 
                                        item={item} 
                                        updateItem={updateItem} 
                                        removeItem={removeItem}
                                    />
                                ))}
                            </>
                        ) : (
                            <div className="empty-cart">
                                <p className="empty-cart-message">Your cart is empty!</p>
                                <Link to="/shopping" className="continue-shopping-btn">
                                    Continue Shopping
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* RIGHT SIDE - SUMMARY */}
                    {cart.length > 0 && (
                        <aside className="cart-summary">
                            <h3>Order Summary</h3>
                            <div className="summary-item">
                                <span>Subtotal ({selectedItemsCount} items)</span>
                                <span id="subtotal">₱{summary.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="summary-item">
                                <span>Shipping Fee</span>
                                <span id="shipping">₱{summary.shipping.toFixed(2)}</span>
                            </div>
                            <div className="summary-total">
                                <span>Total</span>
                                <span id="total">₱{summary.total.toFixed(2)}</span>
                            </div>
                            
                            <div className="cart-stats">
                                <div className="stat-item">
                                    <span>Total Items:</span>
                                    <span>{cart.length}</span>
                                </div>
                                <div className="stat-item">
                                    <span>Available:</span>
                                    <span>{availableItems.length}</span>
                                </div>
                                <div className="stat-item out-of-stock-stat">
                                    <span>Out of Stock:</span>
                                    <span>{outOfStockCount}</span>
                                </div>
                            </div>
                            
                            <button 
                                type="button"
                                className={`checkout-btn ${isCheckoutDisabled ? 'disabled' : ''}`}
                                onClick={handleCheckout}
                                disabled={isCheckoutDisabled}
                            >
                                Proceed to Checkout ({selectedItemsCount})
                            </button>
                        </aside>
                    )}
                </form>
            </main>
            <Footer/>
        </>
    );
}

export default Cart;