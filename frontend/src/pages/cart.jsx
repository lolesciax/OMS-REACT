import { toast } from "../services/feedback";
import PageSkeleton from "../components/PageSkeleton";
import Skeleton from "../components/Skeleton";
import ProductPhoto from "../components/ProductPhoto";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
import CustomerLayout from "../components/CustomerLayout";
import QuantityInput from "../components/QuantityInput";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?._id || user?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const [remove, setRemove] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(`${BACKEND_URL}/api/cart/${userId}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.cart))
          throw new Error(
            data.error || "We couldn’t load your bag. Please try again.",
          );
        setItems(data.cart);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userId, retry]);
  const available = items.filter((item) => Number(item.currentStock) > 0);
  const selected = available.filter((item) => item.selected && item.qty > 0);
  const allSelected =
    available.length > 0 && available.every((item) => item.selected);
  const subtotal = selected.reduce(
    (sum, item) => sum + Number(item.price) * item.qty,
    0,
  );
  const count = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const request = async (id, values, removing = false) => {
    const response = await apiFetch(
      `${BACKEND_URL}/api/cart/${userId}/${removing ? "remove" : "update"}`,
      {
        method: removing ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: id, ...values }),
      },
    );
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(
        data.error || "Your changes couldn’t be saved. Please try again.",
      );
  };
  const update = async (id, values) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await request(id, values);
      setItems((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                ...values,
                ...(values.quantity
                  ? {
                      qty: values.quantity,
                      requestedQty: values.quantity,
                      quantityAdjusted: false,
                    }
                  : {}),
              }
            : item,
        ),
      );
      toast.success("Your bag has been updated.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  };
  const selectAll = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    const results = await Promise.all(
      available.map(async (item) => {
        try {
          await request(item.id, { selected: !allSelected });
          return item.id;
        } catch {
          return null;
        }
      }),
    );
    setItems((previous) =>
      previous.map((item) =>
        results.includes(item.id) ? { ...item, selected: !allSelected } : item,
      ),
    );
    if (results.some((id) => !id))
      setError("Some selections couldn’t be saved. Please try again.");
    else
      toast.success(
        allSelected
          ? "Bag selection cleared."
          : "All available pieces selected.",
      );
    setPending(false);
  };
  const removeItems = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    const results = await Promise.all(
      remove.map(async (item) => {
        try {
          await request(item.id, {}, true);
          return item.id;
        } catch {
          return null;
        }
      }),
    );
    setItems((previous) =>
      previous.filter((item) => !results.includes(item.id)),
    );
    setRemove(null);
    setPending(false);
    if (results.some((id) => !id))
      setError("Some pieces couldn’t be removed. Please try again.");
    else toast.success("The selected pieces were removed from your bag.");
  };
  const checkout = async () => {
    if (pending || !selected.length) return;
    setPending(true);
    setError("");
    try {
      const response = await apiFetch(`${BACKEND_URL}/api/checkout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selected.map((item) => ({
            id: item.id,
            qty: Number(item.qty),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false)
        throw new Error(data.error || "Checkout could not be started.");
      toast.success("Your selected pieces are ready for checkout.");
      navigate("/checkout");
    } catch (error) {
      setError(error.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <CustomerLayout cartCount={count}>
      <div className="customer-heading flex justify-between items-center gap-6 mb-7 max-[760px]:items-start max-[760px]:flex-col max-[760px]:gap-3">
        <div>
          <span className="ui-eyebrow">Your good finds</span>
          <h1>
            Your bag
            <span className="heading-count">
              {loading ? <Skeleton className="size-3 rounded-full" /> : count}
            </span>
          </h1>
          <p>A few good pieces, ready for their next chapter.</p>
        </div>
        <Link to="/" className="customer-back">
          <Icon name="back" size={16} /> Continue browsing
        </Link>
      </div>
      {error && (
        <div className="ui-message error" role="alert">
          {error}
          <button
            className="ui-button ui-button-light"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      )}
      <p className="customer-live" role="status" aria-live="polite">
        {pending ? "Saving your changes…" : status}
      </p>
      {loading ? (
        <PageSkeleton variant="cart" label="Getting your bag ready" />
      ) : !items.length && !error ? (
        <div className="ui-empty">
          <Icon name="bag" size={40} />
          <h2>Your next find is waiting.</h2>
          <p>
            Your bag is empty for now. Explore the collection and add a piece
            that feels like you.
          </p>
          <Link to="/" className="ui-button ui-button-dark">
            Explore the collection <Icon name="arrow" />
          </Link>
        </div>
      ) : (
        items.length > 0 && (
          <div className="customer-columns grid grid-cols-[minmax(0,_1fr)_340px] gap-8 items-start max-[1000px]:grid-cols-[minmax(0,_1fr)_300px] max-[1000px]:gap-6 max-[760px]:block">
            <section
              className="bag-list border border-line rounded-[12px] bg-white py-0 px-6 max-[1000px]:px-[18px]"
              aria-label="Items in your bag"
            >
              <div className="bag-selection">
                <label>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={selectAll}
                    disabled={pending || !available.length}
                  />{" "}
                  Select all available ({selected.length}/{available.length})
                </label>
                <button
                  disabled={pending || !selected.length}
                  onClick={() => setRemove(selected)}
                >
                  Remove selected
                </button>
              </div>
              {items.map((item) => (
                <article
                  className={`bag-item grid grid-cols-[18px_92px_minmax(0,_1fr)_108px] gap-[18px] items-center py-[26px] px-0 border-b border-line max-[1000px]:grid-cols-[16px_76px_minmax(0,_1fr)] max-[1000px]:gap-[14px] max-[760px]:grid-cols-[16px_76px_minmax(0,_1fr)] ${Number(item.currentStock) <= 0 ? "unavailable" : ""}`}
                  key={item.id}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.name}`}
                    checked={!!item.selected && Number(item.currentStock) > 0}
                    disabled={pending || Number(item.currentStock) <= 0}
                    onChange={(event) =>
                      update(item.id, { selected: event.target.checked })
                    }
                  />
                  <ProductPhoto
                    className="bag-item-photo"
                    src={item.image}
                    name={item.name}
                  />
                  <div className="bag-item-info">
                    <h2>{item.name}</h2>
                    <p>
                      {item.condition || "Pre-loved"}
                      {item.size ? ` · Size ${item.size}` : ""}
                    </p>
                    <span
                      className={
                        Number(item.currentStock) <= 0 ? "bag-unavailable" : ""
                      }
                    >
                      {Number(item.currentStock) > 0
                        ? `${item.currentStock} available`
                        : "This piece is no longer available"}
                    </span>
                    <strong>{formatPrice(item.price)}</strong>
                    {item.quantityAdjusted && (
                      <p className="mt-2 text-small text-accent" role="status">
                        Quantity adjusted from {item.requestedQty} to {item.qty}{" "}
                        to match current stock. Review before checkout.
                      </p>
                    )}
                  </div>
                  <div className="bag-item-actions">
                    {Number(item.currentStock) > 0 && (
                      <QuantityInput
                        name={item.name}
                        value={Number(item.qty)}
                        max={Math.min(99, Number(item.currentStock))}
                        disabled={pending}
                        onChange={(quantity) => update(item.id, { quantity })}
                      />
                    )}
                    <strong>
                      {formatPrice(Number(item.price) * item.qty)}
                    </strong>
                    <button
                      className="bag-remove"
                      disabled={pending}
                      onClick={() => setRemove([item])}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </section>
            <aside className="customer-summary border-t-4 border-t-tangelo sticky top-6 p-7 bg-white border border-line rounded-[12px] max-[760px]:static max-[760px]:mt-6 max-[760px]:p-6">
              <span className="ui-eyebrow">The little details</span>
              <h2>Your order summary</h2>
              <div className="summary-row">
                <span>Selected pieces</span>
                <span>{selected.reduce((sum, item) => sum + item.qty, 0)}</span>
              </div>
              <div className="summary-row">
                <span>Items subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="summary-total">
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <button
                className="ui-button ui-button-dark"
                disabled={pending || !selected.length}
                onClick={checkout}
              >
                Continue to checkout <Icon name="arrow" size={18} />
              </button>
              {!selected.length && (
                <p className="ui-field-hint">
                  Select at least one available piece to continue.
                </p>
              )}
              <p className="summary-note">
                <Icon name="shield" size={18} /> Your final shipping fee is
                based on your delivery address.
              </p>
            </aside>
          </div>
        )
      )}
      {remove && (
        <ConfirmDialog
          title={
            remove.length === 1 ? "Remove this piece?" : "Remove these pieces?"
          }
          description="They’ll leave your bag. You can find them in the collection again while stock lasts."
          confirmLabel="Remove from bag"
          busy={pending}
          onConfirm={removeItems}
          onClose={() => setRemove(null)}
        />
      )}
    </CustomerLayout>
  );
}
