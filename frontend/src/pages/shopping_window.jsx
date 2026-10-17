import Image from "../components/Image";
import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { useAuth } from "../contexts/AuthContext";
import { filterProducts, formatPrice } from "../utils/catalog";
import useDialog from "../hooks/useDialog";
import StoreHeader from "../components/StoreHeader";
import Footer from "../components/Footer";
import Icon from "../components/Icon";
import "../styles/shopping.css";

const productId = (product) => product._id || product.id;

export default function ShoppingWindow() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const dialog = useDialog(!!selected, () => {
    if (!adding) setSelected(null);
  });
  const userId = user?._id || user?.id;

  const loadCart = useCallback(async () => {
    if (!userId) {
      setCartCount(0);
      return;
    }
    try {
      const response = await apiFetch(`${BACKEND_URL}/api/cart/${userId}`);
      const data = await response.json();
      if (response.ok && data.success)
        setCartCount(
          (data.cart || []).reduce(
            (sum, item) => sum + Number(item.qty || 0),
            0,
          ),
        );
    } catch {
      /* Shopping remains available if the cart cannot be refreshed. */
    }
  }, [userId]);
  useEffect(() => {
    loadCart();
  }, [loadCart]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(`${BACKEND_URL}/api/products`, {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("We couldn’t load the collection. Please try again.");
        const data = await response.json();
        const list = data.products || data;
        if (!Array.isArray(list))
          throw new Error("The collection is temporarily unavailable.");
        setProducts(list);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure.message || "Check your connection and try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [retry]);

  const categories = [
    "All",
    ...new Set(products.map((item) => item.category).filter(Boolean)),
  ];
  const visible = filterProducts(products, {
    search,
    category,
    sort,
    inStockOnly,
  });
  const filtered = !!search.trim() || category !== "All" || inStockOnly;
  const resetFilters = () => {
    setSearch("");
    setCategory("All");
    setInStockOnly(false);
    setSort("featured");
  };
  const openProduct = (product) => {
    setSelected(product);
    setFeedback(null);
  };
  const addToCart = async () => {
    if (adding || !selected || Number(selected.stock) <= 0) return;
    setAdding(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`${BACKEND_URL}/api/cart/${userId}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId(selected), quantity: 1 }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          data.error || "We couldn’t add this item. Please try again.",
        );
      await loadCart();
      setFeedback({
        type: "success",
        text: "Added to your bag. Keep browsing or head to checkout.",
      });
    } catch (failure) {
      setFeedback({ type: "error", text: failure.message });
    } finally {
      setAdding(false);
    }
  };
  const buyNow = async () => {
    if (adding) return;
    setAdding(true);
    setFeedback(null);
    try {
      const response = await apiFetch(`${BACKEND_URL}/api/checkout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ id: productId(selected), qty: 1 }] }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Checkout could not be started.");
      navigate("/checkout");
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
    } finally {
      setAdding(false);
    }
  };
  const heroImage =
    products.find((item) => Number(item.stock) > 0 && item.image)?.image ||
    "/p3.jpg";

  return (
    <div className="shopping-window">
      <a className="skip-link" href="#collection">
        Skip to collection
      </a>
      <div className="shop-announcement">
        <Icon name="leaf" size={15} /> Good clothes. Another chapter.
      </div>
      <StoreHeader cartCount={cartCount} />
      <section className="shop-hero" aria-labelledby="shop-title">
        <div className="shop-hero-copy">
          <span className="ui-eyebrow">Less ordinary. More you.</span>
          <h1 id="shop-title">
            Good finds.
            <br />
            Great <em>second acts.</em>
          </h1>
          <p>
            Discover pre-loved pieces with a little history and a lot of life
            left. Your next wardrobe favorite is waiting.
          </p>
          <a href="#collection" className="ui-button ui-button-dark">
            Explore the collection <Icon name="arrow" />
          </a>
          <div className="shop-hero-note">
            <span className="shop-note-line" /> A fresh perspective on getting
            dressed.
          </div>
        </div>
        <div className="shop-hero-visual">
          <div className="shop-hero-photo">
            <Image
              src={heroImage}
              alt="A pre-loved piece from the Old Goods Thrift collection"
            />
            <span className="shop-photo-label">Made for another story.</span>
          </div>
          <span className="shop-round-note">
            GOOD FINDS
            <br />
            <Icon name="leaf" size={24} />
            <br />
            SECOND LIVES
          </span>
          <span className="shop-image-caption">
            THE OLD GOODS EDIT / PRE-LOVED & RE-LOVED
          </span>
        </div>
      </section>
      <div className="shop-benefits">
        <span>
          <Icon name="leaf" /> Thoughtfully pre-loved
        </span>
        <span>
          <Icon name="truck" /> Shipped nationwide
        </span>
        <span>
          <Icon name="shield" /> Payment reviewed by our team
        </span>
      </div>
      <main id="collection" className="shop-collection" tabIndex={-1}>
        <div className="shop-collection-heading">
          <div>
            <span className="ui-eyebrow">The collection</span>
            <h2>Find your next favorite.</h2>
          </div>
          <p>Different pieces. Same good feeling.</p>
        </div>
        <div className="shop-toolbar">
          <div className="shop-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label="Search the collection"
              placeholder="Try a style, size, or something you love…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <Icon name="close" size={17} />
              </button>
            )}
          </div>
          <label className="shop-sort">
            Sort by
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name: A–Z</option>
            </select>
          </label>
        </div>
        <div className="shop-filter-row">
          <div
            className="shop-categories"
            role="group"
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <button
                key={item}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item === "All" ? "All finds" : item}
              </button>
            ))}
          </div>
          <label className="shop-available">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
            />{" "}
            Available only
          </label>
        </div>
        <div className="shop-result-line" role="status" aria-live="polite">
          <span>
            {loading
              ? "Getting the collection ready…"
              : error
                ? "Collection unavailable"
                : `${visible.length} ${visible.length === 1 ? "find" : "finds"}${search.trim() ? ` for “${search.trim()}”` : ""}`}
          </span>
          {filtered && (
            <button onClick={resetFilters}>
              Reset filters <Icon name="close" size={14} />
            </button>
          )}
        </div>
        {error ? (
          <div className="ui-empty" role="alert">
            <Icon name="refresh" size={32} />
            <h3>A small pause in browsing.</h3>
            <p>{error}</p>
            <button
              className="ui-button ui-button-dark"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div
            className="shop-grid"
            aria-label="Loading products"
            aria-busy="true"
          >
            {Array.from({ length: 4 }, (_, i) => (
              <div className="shop-skeleton" key={i}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : !visible.length ? (
          <div className="ui-empty">
            <Icon name="search" size={32} />
            <h3>
              {filtered
                ? "No finds this time."
                : "Something good is on its way."}
            </h3>
            <p>
              {filtered
                ? "Try a different search or clear your filters to see more pieces."
                : "Our collection is being refreshed. Check back for more pre-loved pieces."}
            </p>
            {filtered && (
              <button
                className="ui-button ui-button-dark"
                onClick={resetFilters}
              >
                See all finds
              </button>
            )}
          </div>
        ) : (
          <div className="shop-grid">
            {visible.map((product) => (
              <button
                className={`shop-product ${Number(product.stock) <= 0 ? "is-unavailable" : ""}`}
                key={productId(product)}
                onClick={() => openProduct(product)}
                aria-label={`View ${product.name}, ${formatPrice(product.price)}${Number(product.stock) <= 0 ? ", sold out" : ""}`}
              >
                <div className="shop-product-image">
                  <Image
                    src={product.image || "/product-placeholder.svg"}
                    alt=""
                    loading="lazy"
                  />
                  <span className="shop-product-badge">
                    {Number(product.stock) <= 0
                      ? "Sold out"
                      : product.condition || "Pre-loved"}
                  </span>
                  <span className="shop-product-view">
                    Take a closer look <Icon name="arrow" size={17} />
                  </span>
                </div>
                <div className="shop-product-meta">
                  <span>
                    {product.category || "Pre-loved clothing"}
                    {product.size ? ` · Size ${product.size}` : ""}
                  </span>
                  <h3>{product.name || "Pre-loved piece"}</h3>
                  <strong>{formatPrice(product.price)}</strong>
                </div>
              </button>
            ))}
          </div>
        )}
        {!isLoggedIn && !loading && !error && visible.length > 0 && (
          <div className="shop-join-note">
            <div>
              <h3>Found something that feels like you?</h3>
              <p>Sign in to save it to your bag and make it yours.</p>
            </div>
            <Link className="ui-button ui-button-light" to="/login">
              Sign in to shop <Icon name="arrow" size={18} />
            </Link>
          </div>
        )}
      </main>
      <Footer />
      {selected && (
        <div
          className="shop-dialog-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !adding)
              setSelected(null);
          }}
        >
          <section
            ref={dialog}
            className="shop-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-title"
            tabIndex={-1}
          >
            <button
              className="shop-dialog-close"
              aria-label="Close product details"
              disabled={adding}
              onClick={() => setSelected(null)}
            >
              <Icon name="close" />
            </button>
            <div className="shop-dialog-image">
              <Image
                src={selected.image || "/product-placeholder.svg"}
                alt={selected.name}
              />
            </div>
            <div className="shop-dialog-details">
              <span className="ui-eyebrow">
                {selected.category || "A good find"}
              </span>
              <h2 id="product-title">{selected.name}</h2>
              <p className="shop-dialog-price">{formatPrice(selected.price)}</p>
              <p className="shop-dialog-description">
                {selected.description ||
                  "A pre-loved piece, ready for its next chapter."}
              </p>
              <dl className="shop-specs">
                <div>
                  <dt>Condition</dt>
                  <dd>{selected.condition || "Pre-loved"}</dd>
                </div>
                {selected.size && (
                  <div>
                    <dt>Size</dt>
                    <dd>{selected.size}</dd>
                  </div>
                )}
                {selected.material && (
                  <div>
                    <dt>Material</dt>
                    <dd>{selected.material}</dd>
                  </div>
                )}
                <div>
                  <dt>Availability</dt>
                  <dd>
                    {Number(selected.stock) > 0
                      ? `${selected.stock} available`
                      : "Sold out"}
                  </dd>
                </div>
              </dl>
              {feedback && (
                <div
                  className={`ui-message ${feedback.type}`}
                  role={feedback.type === "error" ? "alert" : "status"}
                >
                  {feedback.text}
                  {feedback.type === "success" && (
                    <Link to="/cart">
                      View your bag <Icon name="arrow" size={16} />
                    </Link>
                  )}
                </div>
              )}
              {Number(selected.stock) <= 0 ? (
                <div className="ui-message">
                  This piece has already found a new home. Explore the
                  collection for more good finds.
                </div>
              ) : !isLoggedIn ? (
                <>
                  <Link className="ui-button ui-button-dark" to="/login">
                    Sign in to make it yours <Icon name="arrow" />
                  </Link>
                  <p className="shop-dialog-footnote">
                    New here? <Link to="/signup">Create an account</Link>
                  </p>
                </>
              ) : (
                <div className="shop-dialog-actions">
                  <button
                    className="ui-button ui-button-dark"
                    onClick={addToCart}
                    disabled={adding}
                  >
                    {adding ? "Adding to your bag…" : "Add to bag"}
                    <Icon name="bag" />
                  </button>
                  <button
                    className="ui-button ui-button-light"
                    onClick={buyNow}
                    disabled={adding}
                  >
                    Buy now <Icon name="arrow" />
                  </button>
                </div>
              )}
              <p className="shop-dialog-footnote">
                Shipping is calculated at checkout. Payment is reviewed by our
                team.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
