import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "../styles/shopping.css";
import Footer from '../components/Footer';

const ShoppingWindow = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, logout } = useAuth();
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  // Sample products (fallback)
  const sampleProducts = [
    {
      id: 1,
      name: "Photo Fade Tee",
      description: "Retro Fade Tee Soft cotton tee with natural vintage fade. Feels broken in and comfy.",
      price: 99.00,
      condition: "Good",
      size: "M",
      material: "Cotton",
      image: "/images/p1.jpg",
      stock: 5
    },
    {
      id: 2,
      name: "Checkmate Polo",
      description: "Classic check pattern with that clean thrift find vibe.",
      price: 120.00,
      condition: "Like New",
      size: "L",
      material: "Cotton-Polyester",
      image: "/images/p2.jpg",
      stock: 3
    },
    {
      id: 3,
      name: "Street Rider Jacket",
      description: "Sleek bomber jacket perfect for layering. Lightly worn, still sharp.",
      price: 180.00,
      condition: "Excellent",
      size: "XL",
      material: "Denim",
      image: "/images/p3.jpg",
      stock: 0
    },
    {
      id: 4,
      name: "Striped Chill Shirt",
      description: "Relaxed fit with cool stripes. Everyday essential piece.",
      price: 85.00,
      condition: "Good",
      size: "M",
      material: "Cotton",
      image: "/images/p4.jpg",
      stock: 8
    }
  ];

  // Load user cart if logged in
  useEffect(() => {
    if (isLoggedIn && user) {
      loadUserCart();
    } else {
      setCart([]);
    }
  }, [isLoggedIn, user]);

  // Load products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:5000/api/products');
        
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || data || []);
        } else {
          // Use sample data if API fails
          setProducts(sampleProducts);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts(sampleProducts);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Load user cart from database
  const loadUserCart = async () => {
    if (!isLoggedIn || !user) return;
    
    try {
      const userId = user.id || user.username || user._id;
      const response = await fetch(`http://localhost:5000/api/cart/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCart(data.cart || []);
        }
      }
    } catch (error) {
      console.error('Error loading cart from database:', error);
      setCart([]);
    }
  };

  // Open product modal
  const openProductModal = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
    document.body.style.overflow = 'hidden';
  };

  // Close product modal
  const closeProductModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
    document.body.style.overflow = 'auto';
  };

  // Add to cart function with login check - FIXED: Using correct endpoint
  const addToCart = async (product) => {
    if (!isLoggedIn || !user) {
      alert('Please log in to add items to cart.');
      navigate('/login');
      return;
    }

    // Check stock before adding to cart
    if (product.stock <= 0) {
      alert('Sorry, this product is out of stock.');
      return;
    }

    setAddingToCart(true);

    try {
      const userId = user.id || user.username || user._id;
      
      // FIXED: Using the correct endpoint - /api/cart/[user_id]/add
      const response = await fetch(`http://localhost:5000/api/cart/${userId}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: product._id || product.id,
          quantity: 1
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Show success animation
        const cartCount = document.querySelector('.cart-count');
        if (cartCount) {
          cartCount.classList.add('bounce');
          setTimeout(() => cartCount.classList.remove('bounce'), 1000);
        }
        
        // Reload cart to get updated count
        loadUserCart();
        
        // Close modal after successful add
        setTimeout(() => {
          closeProductModal();
        }, 1000);
      } else {
        alert(data.error || 'Failed to add item to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  // Alternative add to cart function using the /api/cart/add endpoint
  const addToCartAlternative = async (product) => {
    if (!isLoggedIn || !user) {
      alert('Please log in to add items to cart.');
      navigate('/login');
      return;
    }

    // Check stock before adding to cart
    if (product.stock <= 0) {
      alert('Sorry, this product is out of stock.');
      return;
    }

    setAddingToCart(true);

    try {
      const userId = user.id || user.username || user._id;
      
      // Alternative endpoint: /api/cart/add with user ID in body
      const response = await fetch(`http://localhost:5000/api/cart/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          productId: product._id || product.id,
          quantity: 1
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Show success animation
        const cartCount = document.querySelector('.cart-count');
        if (cartCount) {
          cartCount.classList.add('bounce');
          setTimeout(() => cartCount.classList.remove('bounce'), 1000);
        }
        
        // Reload cart to get updated count
        loadUserCart();
        
        // Close modal after successful add
        setTimeout(() => {
          closeProductModal();
        }, 1000);
      } else {
        alert(data.error || 'Failed to add item to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add item to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  // Buy now function with login check
  const buyNow = async (product) => {
    if (!isLoggedIn || !user) {
      alert('Please log in to proceed with purchase.');
      navigate('/login');
      return;
    }

    // Check stock before proceeding
    if (product.stock <= 0) {
      alert('Sorry, this product is out of stock.');
      return;
    }

    try {
      // Prepare checkout data with only this product
      const checkoutData = {
        items: [{
          id: product._id || product.id,
          product_id: product._id || product.id,
          name: product.name,
          price: product.price,
          condition: product.condition,
          image: product.image,
          stock: product.stock,
          qty: 1,
          size: product.size,
          material: product.material
        }],
        summary: {
          subtotal: product.price,
          shipping: 50.00,
          total: product.price + 50.00
        }
      };

      // Save checkout data to localStorage
      localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
      
      console.log('🛒 Buy Now - Checkout data:', checkoutData);

      // Navigate directly to checkout
      navigate('/checkout');

    } catch (error) {
      console.error('Error in buy now:', error);
      alert('Failed to process buy now request');
    }
  };

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    alert('You have been logged out successfully!');
    // No redirect needed - user stays on shopping page
  };

  // Filter products based on search and separate by stock status
  const filterAndSortProducts = (products) => {
    const filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Separate in-stock and out-of-stock products
    const inStockProducts = filtered.filter(product => product.stock > 0);
    const outOfStockProducts = filtered.filter(product => product.stock <= 0);

    // Return both arrays for separate rendering
    return { inStockProducts, outOfStockProducts };
  };

  const { inStockProducts, outOfStockProducts } = filterAndSortProducts(products);

  return (
    <div className="shopping-window">
      {/* ===== HEADER - FIXED ===== */}
      <header className="header">
        <div className="logo">
          <img src="/Shop Icon.jpg" alt="Shop Logo" />
          <div className="logo-text">
            <h2>Old Goods Thrift</h2>
          </div>
        </div>
        {isLoggedIn ? (
          <div className="user-section">
            <span>Welcome, {user.username}!</span>
            {user.isAdmin && (
              <button 
                onClick={() => navigate('/admin/dashboard')} 
                className="admin-btn"
              >
                Manage Store
              </button>
            )}
            <button onClick={handleLogout} className="logout-btn">
              Log Out
            </button>
          </div>
        ) : (
          <Link to="/login" className="help-link">Log In / Sign Up</Link>
        )}
      </header>

      {/* ===== PROMO SECTION ===== */}
      <section className="promo-section">
        <h1>The Best Finds of the Year</h1>
        <p>Bermonths of Unique Deals.</p>
        <p><strong>'Ber' Ready to Save.</strong></p>
        {!isLoggedIn && (
          <div className="guest-notice">
            <p>🔒 Browse our products! Log in to add items to cart and make purchases.</p>
          </div>
        )}
      </section>

      {/* ===== SEARCH BAR + ICONS ===== */}
      <section className="search-container">
        <form onSubmit={handleSearch}>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for products..." 
          />
          <button type="submit">🔍</button>
        </form>
        
        {/* Navigation Icons - Show for all users but disable for guests */}
        <div className="nav-icons">
          {isLoggedIn ? (
            <>
              <Link to="/cart" className="icon-btn" title="View Cart">
                🛒 {cart.length > 0 && <span className="cart-count">{cart.reduce((total, item) => total + (item.qty || 1), 0)}</span>}
              </Link>
              <Link to="/profile" className="icon-btn" title="Profile">
                👤
              </Link>
              <Link to="/order-history" className="icon-btn" title="Order History">
                📦
              </Link>
            </>
          ) : (
            <>
              <span className="icon-btn disabled" title="Login to access cart">🛒</span>
              <span className="icon-btn disabled" title="Login to access profile">👤</span>
              <span className="icon-btn disabled" title="Login to view order history">📦</span>
            </>
          )}
        </div>
      </section>

      {/* ===== PRODUCT GRID ===== */}
      <main className="product-grid-container">
        {isLoading ? (
          <div className="loading">Loading products...</div>
        ) : inStockProducts.length === 0 && outOfStockProducts.length === 0 ? (
          <p className="no-results">
            {searchTerm ? 'No matching products found.' : 'No products available.'}
          </p>
        ) : (
          <>
            {/* IN STOCK PRODUCTS SECTION */}
            {inStockProducts.length > 0 && (
              <div className="products-section">
                <h3 className="section-title">
                  Available Products ({inStockProducts.length})
                  {!isLoggedIn && <span className="login-hint"> - Log in to purchase</span>}
                </h3>
                <div className="product-grid">
                  {inStockProducts.map(product => (
                    <div 
                      key={product.id || product._id} 
                      className="product-card"
                      onClick={() => openProductModal(product)}
                    >
                      <div className="product-image-container">
                        <img 
                          src={product.image || "/images/placeholder.jpg"} 
                          alt={product.name}
                          onError={(e) => {
                            e.target.src = "/images/placeholder.jpg";
                          }}
                        />
                        {!isLoggedIn && (
                          <div className="login-overlay">
                            <span>Click to view details</span>
                          </div>
                        )}
                      </div>
                      <div className="card-details">
                        <p className="description">
                          <b>{product.name}</b> {product.description}
                        </p>
                        <div className="price-condition">
                          <span className="price">₱{product.price}</span>
                          <span className="condition">{product.condition || 'Good'}</span>
                        </div>
                        <div className="stock-info">
                          <span className="in-stock">In Stock: {product.stock}</span>
                        </div>
                        {!isLoggedIn && (
                          <div className="guest-action-hint">
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OUT OF STOCK PRODUCTS SECTION */}
            {outOfStockProducts.length > 0 && (
              <div className="products-section out-of-stock-section">
                <h3 className="section-title out-of-stock-title">Out of Stock ({outOfStockProducts.length})</h3>
                <div className="product-grid">
                  {outOfStockProducts.map(product => (
                    <div 
                      key={product.id || product._id} 
                      className="product-card out-of-stock"
                      onClick={() => openProductModal(product)}
                    >
                      <div className="out-of-stock-banner">Out of Stock</div>
                      <div className="product-image-container">
                        <img 
                          src={product.image || "/images/placeholder.jpg"} 
                          alt={product.name}
                          onError={(e) => {
                            e.target.src = "/images/placeholder.jpg";
                          }}
                        />
                      </div>
                      <div className="card-details">
                        <p className="description">
                          <b>{product.name}</b> {product.description}
                        </p>
                        <div className="price-condition">
                          <span className="price">₱{product.price}</span>
                          <span className="condition">{product.condition || 'Good'}</span>
                        </div>
                        <div className="stock-info">
                          <span className="out-of-stock-text">Out of Stock</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ===== PRODUCT MODAL ===== */}
      {showModal && selectedProduct && (
        <div className="product-modal-overlay" onClick={closeProductModal}>
          <div className="product-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedProduct.name}</h2>
              <button className="modal-close-btn" onClick={closeProductModal}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="modal-image-section">
                <img 
                  src={selectedProduct.image || "/images/placeholder.jpg"} 
                  alt={selectedProduct.name}
                  className="modal-product-image"
                  onError={(e) => {
                    e.target.src = "/images/placeholder.jpg";
                  }}
                />
              </div>
              
              <div className="modal-details-section">
                <div className="product-info">
                  <p className="modal-product-description">{selectedProduct.description}</p>
                  
                  <div className="product-specs">
                    <div className="specs-grid">
                      <div className="spec-item">
                        <span className="spec-label">Price:</span>
                        <span className="spec-value price">₱{selectedProduct.price}</span>
                      </div>
                      <div className="spec-item">
                        <span className="spec-label">Condition:</span>
                        <span className={`spec-value condition ${selectedProduct.condition?.toLowerCase().replace(' ', '')}`}>
                          {selectedProduct.condition || 'Good'}
                        </span>
                      </div>
                      {selectedProduct.size && (
                        <div className="spec-item">
                          <span className="spec-label">Size:</span>
                          <span className="spec-value size">{selectedProduct.size}</span>
                        </div>
                      )}
                      {selectedProduct.material && (
                        <div className="spec-item">
                          <span className="spec-label">Material:</span>
                          <span className="spec-value material">{selectedProduct.material}</span>
                        </div>
                      )}
                      <div className="spec-item">
                        <span className="spec-label">Stock:</span>
                        <span className={`spec-value stock ${selectedProduct.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
                          {selectedProduct.stock > 0 ? `${selectedProduct.stock} available` : 'Out of Stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button 
                    className={`modal-add-to-cart-btn ${addingToCart ? 'adding' : ''} ${selectedProduct.stock <= 0 ? 'disabled' : !isLoggedIn ? 'login-required' : ''}`}
                    onClick={() => addToCart(selectedProduct)}
                    disabled={selectedProduct.stock <= 0 || addingToCart || !isLoggedIn}
                  >
                    {addingToCart ? (
                      <>
                        <span className="spinner"></span>
                        Adding to Cart...
                      </>
                    ) : !isLoggedIn ? (
                      'Login to Add to Cart'
                    ) : (
                      selectedProduct.stock > 0 ? 'Add to Cart 🛒' : 'Out of Stock'
                    )}
                  </button>
                  
                  <button 
                    className={`modal-buy-now-btn ${selectedProduct.stock <= 0 ? 'disabled' : !isLoggedIn ? 'login-required' : ''}`}
                    onClick={() => buyNow(selectedProduct)}
                    disabled={selectedProduct.stock <= 0 || !isLoggedIn}
                  >
                    {!isLoggedIn ? 'Login to Buy Now' : 'Buy Now'}
                  </button>
                </div>

                {/* Login prompt for non-logged users */}
                {!isLoggedIn && (
                  <div className="login-prompt">
                    <p>Please log in to add items to cart or make purchases.</p>
                    <button 
                      className="login-redirect-btn"
                      onClick={() => {
                        closeProductModal();
                        navigate('/login');
                      }}
                    >
                      Go to Login
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

  <Footer/>
    </div>
  );
};

export default ShoppingWindow;