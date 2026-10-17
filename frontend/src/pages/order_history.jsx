import Image from "../components/Image";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
import CustomerLayout from "../components/CustomerLayout";
import UploadField from "../components/UploadField";
import Icon from "../components/Icon";
import useDialog from "../hooks/useDialog";

const statusLabels = {
  pending: "Payment review",
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Getting ready",
  shipped: "On its way",
  completed: "Delivered",
};
const dateLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};
const steps = ["pending", "confirmed", "processing", "shipped", "completed"];

export default function OrderHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?._id || user?.id;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState("all");
  const [receipt, setReceipt] = useState(null);
  const [file, setFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialog = useDialog(!!receipt, () => {
    if (!busy) setReceipt(null);
  });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(
          `${BACKEND_URL}/api/orders/user/${userId}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.orders))
          throw new Error(
            data.error || "Your orders couldn’t be loaded. Please try again.",
          );
        setOrders(data.orders);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userId, retry]);
  const resume = (order) =>
    navigate(`/checkout?order=${encodeURIComponent(order._id)}`);
  const confirm = async (event) => {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setUploadError("");
    try {
      const proofImage = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(new Error("The image couldn’t be read. Choose it again."));
        reader.readAsDataURL(file);
      });
      const response = await apiFetch(
        `${BACKEND_URL}/api/orders/${receipt._id}/confirm-receipt`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, proofImage }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          data.error || "Delivery couldn’t be confirmed. Please try again.",
        );
      setOrders((previous) =>
        previous.map((order) =>
          order._id === receipt._id ? { ...order, status: "completed" } : order,
        ),
      );
      setReceipt(null);
      setFile(null);
      setMessage(
        "Delivery confirmed. Thank you for giving these pieces a new home.",
      );
    } catch (failure) {
      setUploadError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const matches = (order, filter) =>
    filter === "all" ||
    (filter === "review"
      ? ["pending", "pending_payment"].includes(order.status)
      : filter === "progress"
        ? ["confirmed", "processing", "shipped"].includes(order.status)
        : order.status === "completed");
  const visible = orders.filter((order) => matches(order, tab));
  return (
    <CustomerLayout>
      <div className="customer-heading">
        <div>
          <span className="ui-eyebrow">The journey of your finds</span>
          <h1>Your orders</h1>
          <p>From a good find to a new favorite. Follow every step here.</p>
        </div>
        <Link to="/" className="customer-back">
          <Icon name="back" size={16} /> Back to the collection
        </Link>
      </div>
      {message && (
        <div className="ui-message success" role="status">
          {message}
        </div>
      )}
      <div className="order-tabs" role="group" aria-label="Filter orders">
        {[
          ["all", "All orders"],
          ["review", "Payment & review"],
          ["progress", "In progress"],
          ["completed", "Delivered"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
            <span>{orders.filter((order) => matches(order, key)).length}</span>
          </button>
        ))}
      </div>
      {error ? (
        <div className="ui-empty" role="alert">
          <h2>Let’s try that again.</h2>
          <p>{error}</p>
          <button
            className="ui-button ui-button-dark"
            onClick={() => setRetry((value) => value + 1)}
          >
            Reload orders
          </button>
        </div>
      ) : loading ? (
        <div className="ui-empty" role="status" aria-busy="true">
          Finding your orders…
        </div>
      ) : !visible.length ? (
        <div className="ui-empty">
          <Icon name="orders" size={38} />
          <h2>
            {orders.length
              ? "Nothing in this chapter yet."
              : "Every story starts with a first find."}
          </h2>
          <p>
            {orders.length
              ? "Try another filter to see your other orders."
              : "When you order a piece, you’ll be able to follow its journey here."}
          </p>
          <Link to="/" className="ui-button ui-button-dark">
            Explore the collection <Icon name="arrow" />
          </Link>
        </div>
      ) : (
        <div className="order-list">
          {visible.map((order) => {
            const current = Math.max(0, steps.indexOf(order.status));
            const awaitingPayment =
              ["pending", "pending_payment"].includes(order.status) &&
              !order.paymentProof;
            return (
              <article className="order-card" key={order._id}>
                <header className="order-card-header">
                  <div>
                    <span>
                      ORDER{" "}
                      {order.orderNumber || order._id.slice(-6).toUpperCase()}
                    </span>
                    <p>
                      Placed {dateLabel(order.orderDate || order.createdAt)}
                    </p>
                  </div>
                  <span className={`order-state ${order.status}`}>
                    {awaitingPayment
                      ? "Awaiting payment"
                      : statusLabels[order.status] || order.status}
                  </span>
                </header>
                <div className="order-card-body">
                  <ol className="order-journey" aria-label="Order progress">
                    {steps.map((status, index) => (
                      <li
                        key={status}
                        className={index <= current ? "reached" : ""}
                        aria-current={index === current ? "step" : undefined}
                      >
                        <span>
                          {index < current ? (
                            <Icon name="check" size={12} />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <small>
                          {status === "pending"
                            ? awaitingPayment
                              ? "Payment"
                              : "Review"
                            : statusLabels[status]}
                        </small>
                      </li>
                    ))}
                  </ol>
                  <div className="order-piece-list">
                    {(order.items || []).map((item, i) => (
                      <div key={item.id || i}>
                        <Image
                          src={item.image || "/product-placeholder.svg"}
                          alt={item.name}
                        />
                        <div>
                          <h2>{item.name}</h2>
                          <p>
                            Qty {item.qty}
                            {item.size ? ` · Size ${item.size}` : ""}
                          </p>
                        </div>
                        <strong>
                          {formatPrice(Number(item.price) * item.qty)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  {order.trackingNumber && (
                    <div className="order-tracking">
                      <Icon name="truck" />
                      <div>
                        <strong>Tracking number</strong>
                        <span>{order.trackingNumber}</span>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              order.trackingNumber,
                            );
                            setMessage("Tracking number copied.");
                          } catch {
                            setMessage(
                              "Your tracking number is " + order.trackingNumber,
                            );
                          }
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  <div className="order-card-bottom">
                    <p>
                      {order.shippingAddress?.city
                        ? `Delivering to ${order.shippingAddress.city}, ${order.shippingAddress.province}`
                        : "Delivery details saved with your order."}
                    </p>
                    <div>
                      <span>Total, including shipping</span>
                      <strong>{formatPrice(order.total)}</strong>
                    </div>
                  </div>
                  <div className="order-card-actions">
                    {awaitingPayment && (
                      <>
                        <p>
                          Your order is saved. Complete payment and upload proof
                          to continue.
                        </p>
                        <button
                          className="ui-button ui-button-dark"
                          onClick={() => resume(order)}
                        >
                          Complete payment <Icon name="arrow" size={17} />
                        </button>
                      </>
                    )}
                    {order.status === "pending" && order.paymentProof && (
                      <p>
                        <Icon name="shield" size={17} /> Payment proof received.
                        Our team is reviewing it.
                      </p>
                    )}
                    {order.status === "shipped" && (
                      <>
                        <p>
                          Arrived safely? Let us know once you have your pieces.
                        </p>
                        <button
                          className="ui-button ui-button-dark"
                          onClick={() => {
                            setReceipt(order);
                            setFile(null);
                            setUploadError("");
                          }}
                        >
                          Confirm delivery <Icon name="check" size={17} />
                        </button>
                      </>
                    )}
                    {order.status === "completed" && (
                      <p>
                        <Icon name="leaf" size={17} />
                        {order.autoCompletedAt
                          ? "This order was completed automatically after the delivery period."
                          : "Another chapter, another good home. Thank you."}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {receipt && (
        <div className="ui-dialog-overlay">
          <section
            ref={dialog}
            className="ui-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            tabIndex={-1}
          >
            <button
              className="ui-dialog-close"
              disabled={busy}
              onClick={() => setReceipt(null)}
              aria-label="Close delivery confirmation"
            >
              <Icon name="close" />
            </button>
            <h2 id="receipt-title">Made it home?</h2>
            <p>
              Upload a photo of your received pieces to confirm delivery for
              order {receipt.orderNumber}.
            </p>
            {uploadError && (
              <div className="ui-message error" role="alert">
                {uploadError}
              </div>
            )}
            <form onSubmit={confirm}>
              <UploadField
                label="Photo of the received order"
                file={file}
                onChange={setFile}
                onError={setUploadError}
                disabled={busy}
              />
              <button
                className="ui-button ui-button-dark"
                disabled={busy || !file}
                type="submit"
              >
                {busy ? "Confirming delivery…" : "Confirm received"}
                <Icon name="check" size={18} />
              </button>
            </form>
          </section>
        </div>
      )}
    </CustomerLayout>
  );
}
