import { toast } from "../services/feedback";
import Skeleton from "../components/Skeleton";
import { ProductSkeletons } from "../components/PageSkeleton";
import ProductMedia from "../components/ProductMedia";
import ProductPhoto from "../components/ProductPhoto";
import LikeButton from "../components/LikeButton";
import useFavorites from "../hooks/useFavorites";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useDeferredValue,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { useAuth } from "../contexts/AuthContext";
import {
  filterProducts,
  formatPrice,
  isProductAvailable,
} from "../utils/catalog";
import useDialog from "../hooks/useDialog";
import StoreHeader from "../components/StoreHeader";
import Footer from "../components/Footer";
import Icon from "../components/Icon";
import LandingHero from "../components/LandingHero";
import useScrollReveal from "../hooks/useScrollReveal";
import "../styles/shopping.css";

const productId = (product) => product._id || product.id;

export default function ShoppingWindow() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requestedProduct = params.get("product");
  const likedOnly = params.get("liked") === "true";
  const { isLoggedIn, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const search = params.get("q") || "";
  const setSearch = (value) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [notice, setNotice] = useState("");
  const dialog = useDialog(!!selected, () => {
    if (!adding) setSelected(null);
  });
  const userId = user?._id || user?.id;
  const favorites = useFavorites(userId);
  const likeProduct = (product) => {
    if (!isLoggedIn) {
      toast.info("Sign in to keep your liked items across devices.");
      navigate("/login", {
        state: { from: `/?product=${encodeURIComponent(productId(product))}` },
      });
      return;
    }
    void favorites.toggle(String(productId(product)));
  };
  const changeLikedFilter = () => {
    if (!isLoggedIn) {
      navigate("/login", { state: { from: "/?liked=true#collection" } });
      return;
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (likedOnly) next.delete("liked");
        else next.set("liked", "true");
        return next;
      },
      { replace: true },
    );
  };

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
        const data = await response.json();
        if (!response.ok || data.success === false)
          throw new Error("We couldn’t load the collection. Please try again.");
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

  const deferredSearch = useDeferredValue(search);
  const availableProducts = useMemo(
    () => products.filter(isProductAvailable),
    [products],
  );
  const categories = useMemo(
    () => [
      "All",
      ...new Set(
        availableProducts.map((item) => item.category).filter(Boolean),
      ),
    ],
    [availableProducts],
  );
  const visible = useMemo(
    () =>
      filterProducts(
        likedOnly
          ? availableProducts.filter((product) =>
              favorites.ids.has(String(productId(product))),
            )
          : availableProducts,
        {
          search: deferredSearch,
          category,
          sort,
        },
      ),
    [
      availableProducts,
      deferredSearch,
      category,
      sort,
      likedOnly,
      favorites.ids,
    ],
  );
  const filtered = !!search.trim() || category !== "All" || likedOnly;
  const collection = useScrollReveal(visible);
  useEffect(() => {
    if (loading || error || !requestedProduct) return;
    const product = availableProducts.find(
      (item) => String(productId(item)) === requestedProduct,
    );
    if (product) {
      setSelected(product);
      setFeedback(null);
    } else {
      setNotice(
        "This piece is no longer available. Explore the current collection for more finds.",
      );
      document.getElementById("collection")?.scrollIntoView();
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("product");
        return next;
      },
      { replace: true },
    );
  }, [loading, error, requestedProduct, availableProducts, setParams]);
  const resetFilters = () => {
    setCategory("All");
    setSort("featured");
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("liked");
        next.delete("q");
        return next;
      },
      { replace: true },
    );
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
      toast.success("Added to your bag.");
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
      if (!response.ok || data.success === false)
        throw new Error(data.error || "Checkout could not be started.");
      toast.success("This piece is ready for checkout.");
      navigate("/checkout");
    } catch (error) {
      setFeedback({ type: "error", text: error.message });
    } finally {
      setAdding(false);
    }
  };
  return (
    <div className="shopping-window min-h-dvh flex flex-col bg-paper">
      <a className="skip-link" href="#collection">
        Skip to collection
      </a>
      <div className="landing-intro">
        <StoreHeader
          cartCount={cartCount}
          searchValue={search}
          onSearchChange={setSearch}
        />
        <LandingHero
          products={availableProducts}
          loading={loading}
          onSelect={openProduct}
        />
      </div>
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
      <main
        ref={collection}
        id="collection"
        className="shop-collection max-w-320 w-full my-0 mx-auto py-16 px-7 scroll-mt-6 max-[700px]:py-10 max-[700px]:px-5"
        tabIndex={-1}
        aria-busy={search !== deferredSearch}
      >
        {notice && (
          <div className="ui-message mb-6" role="status">
            {notice}
            <button className="ml-3 underline" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        )}
        <div className="shop-collection-heading" data-reveal>
          <div>
            <span className="ui-eyebrow">The collection</span>
            <h2>Find your next favorite.</h2>
            <p>Different pieces. Same good feeling.</p>
          </div>
          <label className="shop-sort flex items-center gap-[10px] whitespace-nowrap text-small text-muted max-[700px]:ml-auto">
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
        <div
          className="shop-collection-controls shop-likes-toolbar"
          role="group"
          aria-label="Collection filters"
        >
          <label className="shop-category-select" htmlFor="collection-category">
            <span>Category</span>
            <select
              id="collection-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All finds" : item}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="shop-liked-filter"
            aria-pressed={likedOnly}
            onClick={changeLikedFilter}
          >
            <Icon
              name="heart"
              size={19}
              fill={likedOnly ? "currentColor" : "none"}
            />
            {likedOnly ? "Showing liked items" : "Liked items"}
            {isLoggedIn && favorites.ready && <span>{favorites.ids.size}</span>}
          </button>
          <span className="shop-availability">
            <Icon name="check" size={17} /> Available finds only
          </span>
        </div>
        {favorites.error && (
          <div className="ui-message error mb-4" role="alert">
            {favorites.error}
            <button
              type="button"
              className="ui-button ui-button-light"
              onClick={favorites.reload}
            >
              Retry liked items
            </button>
          </div>
        )}
        <div className="shop-result-line" role="status" aria-live="polite">
          <span>
            {loading ? (
              <Skeleton className="h-4 w-40" />
            ) : error ? (
              "Collection unavailable"
            ) : (
              `${visible.length} ${visible.length === 1 ? "find" : "finds"}${search.trim() ? ` for “${search.trim()}”` : ""}`
            )}
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
        ) : loading || (likedOnly && favorites.loading) ? (
          <ProductSkeletons />
        ) : !visible.length ? (
          <div className="ui-empty">
            <Icon name="search" size={32} />
            <h3>
              {filtered
                ? likedOnly
                  ? "Your liked finds"
                  : "No finds this time."
                : "Something good is on its way."}
            </h3>
            <p>
              {filtered
                ? likedOnly
                  ? "Tap a heart to save an item. Only currently available pieces are shown here."
                  : "Try a different search or clear your filters to see more pieces."
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
          <div className="shop-grid grid grid-cols-4 gap-[30px_22px] max-[1000px]:grid-cols-3 max-[700px]:grid-cols-2 max-[700px]:gap-[24px_14px] max-[359px]:grid-cols-[1fr]">
            {visible.map((product, index) => (
              <article
                data-reveal
                data-reveal-delay={(index % 4) * 60}
                className="shop-product"
                key={productId(product)}
              >
                <div className="shop-product-image">
                  <button
                    type="button"
                    className="shop-product-open"
                    onClick={() => openProduct(product)}
                    aria-label={`View ${product.name}, ${formatPrice(product.price)}`}
                  >
                    <ProductMedia
                      src={product.image || "/product-placeholder.svg"}
                      name={product.name}
                      alt=""
                      loading="lazy"
                    />
                  </button>
                  <LikeButton
                    compact
                    name={product.name}
                    liked={favorites.ids.has(String(productId(product)))}
                    pending={favorites.pending.has(String(productId(product)))}
                    disabled={favorites.loading || !favorites.ready}
                    onClick={() => likeProduct(product)}
                  />
                </div>
                <div className="shop-product-meta">
                  <div className="shop-product-status">
                    <span className="shop-product-badge">
                      {Number(product.stock) <= 0
                        ? "Sold out"
                        : product.condition || "Pre-loved"}
                    </span>
                    <Icon name="arrow" size={18} />
                  </div>
                  <span>
                    {product.category || "Pre-loved clothing"}
                    {product.size ? ` · Size ${product.size}` : ""}
                  </span>
                  <h3>
                    <button type="button" onClick={() => openProduct(product)}>
                      {product.name || "Pre-loved piece"}
                    </button>
                  </h3>
                  <div className="shop-product-footer">
                    <strong>{formatPrice(product.price)}</strong>
                    <button
                      type="button"
                      onClick={() => openProduct(product)}
                      aria-label={`View details of ${product.name}`}
                    >
                      View details <Icon name="arrow" size={16} />
                    </button>
                  </div>
                </div>
              </article>
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
            <div className="shop-dialog-media-panel">
              <div className="shop-dialog-media-content">
                <ProductPhoto
                  className="shop-dialog-image"
                  src={selected.image}
                  name={selected.name}
                />
                <p>See the whole piece. Zoom in for a closer look.</p>
              </div>
            </div>
            <div className="shop-dialog-details">
              <span className="ui-eyebrow">
                {selected.category || "A good find"}
              </span>
              <h2 id="product-title">{selected.name}</h2>
              <div className="shop-dialog-price-row">
                <p className="shop-dialog-price">
                  {formatPrice(selected.price)}
                </p>
                <LikeButton
                  name={selected.name}
                  liked={favorites.ids.has(String(productId(selected)))}
                  pending={favorites.pending.has(String(productId(selected)))}
                  disabled={favorites.loading || !favorites.ready}
                  onClick={() => likeProduct(selected)}
                />
              </div>
              {favorites.error && (
                <p className="ui-message error" role="alert">
                  {favorites.error}
                  <button
                    type="button"
                    className="ui-button ui-button-light"
                    onClick={favorites.reload}
                  >
                    Retry liked items
                  </button>
                </p>
              )}
              <h3 className="shop-description-title">About this piece</h3>
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
                  <Link
                    className="ui-button ui-button-dark"
                    to="/login"
                    state={{
                      from: `/?product=${encodeURIComponent(productId(selected))}`,
                    }}
                  >
                    Sign in to make it yours <Icon name="arrow" />
                  </Link>
                  <p className="shop-dialog-footnote">
                    New here?{" "}
                    <Link
                      to="/signup"
                      state={{
                        from: `/?product=${encodeURIComponent(productId(selected))}`,
                      }}
                    >
                      Create an account
                    </Link>
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
