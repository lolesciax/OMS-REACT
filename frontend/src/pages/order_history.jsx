import { toast } from "../services/feedback";
import OrderProgress from "../components/OrderProgress";
import { shortOrderReference } from "../utils/orderProgress";
import PageSkeleton from "../components/PageSkeleton";
import Image from "../components/Image";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
import CustomerLayout from "../components/CustomerLayout";
import UploadField from "../components/UploadField";
import Icon from "../components/Icon";
import useDialog from "../hooks/useDialog";
import { isAwaitingPayment, orderStatusLabel } from "../utils/orders";
import useOrderResource from "../hooks/useOrderResource";

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

export default function OrderHistory() {
  const [searchParams] = useSearchParams();
  const targetOrder = searchParams.get("order");
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?._id || user?.id;
  const [tab, setTab] = useState("all");
  const [receipt, setReceipt] = useState(null);
  const [file, setFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);

  const resource = useOrderResource(
    `${BACKEND_URL}/api/orders/user/${userId}`,
    busy || !!receipt,
  );
  const { loading, refreshing, error } = resource;
  const orders = resource.data?.orders || [];
  useEffect(() => {
    if (!loading && targetOrder && /^[a-f0-9]{24}$/i.test(targetOrder))
      document
        .getElementById(`order-${targetOrder}`)
        ?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [loading, targetOrder]);
  const dialog = useDialog(!!receipt, () => {
    if (!busy) setReceipt(null);
  });
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
          timeout: 60000,
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          data.error || "Delivery couldn’t be confirmed. Please try again.",
        );
      setReceipt(null);
      setFile(null);
      toast.success(
        "Delivery confirmed. Thank you for giving these pieces a new home.",
      );
      // Reload the server timestamps and receipt details for the shared tracker.
      resource.refresh();
    } catch (failure) {
      setUploadError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const matches = (order, filter) =>
    filter === "all" ||
    (filter === "unpaid"
      ? isAwaitingPayment(order)
      : filter === "review"
        ? ["pending", "pending_payment"].includes(order.status) &&
          !isAwaitingPayment(order)
        : filter === "progress"
          ? ["confirmed", "processing", "shipped"].includes(order.status)
          : order.status === "completed");
  const visible = orders.filter((order) => matches(order, tab));
  return (
    <CustomerLayout>
      <div className="customer-heading flex justify-between items-center gap-6 mb-7 max-[760px]:items-start max-[760px]:flex-col max-[760px]:gap-3">
        <div>
          <span className="ui-eyebrow">The journey of your finds</span>
          <h1>Your orders</h1>
          <p>From a good find to a new favorite. Follow every step here.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            className="ui-button ui-button-light"
            disabled={refreshing || busy || !!receipt}
            onClick={() => resource.refresh({ feedback: true })}
          >
            <Icon name="refresh" size={16} />
            {refreshing && !loading ? "Checking status…" : "Refresh status"}
          </button>
          <Link to="/" className="customer-back">
            <Icon name="back" size={16} /> Back to the collection
          </Link>
        </div>
      </div>
      <p className="mb-5 text-small text-muted" role="status">
        {resource.updatedAt
          ? `Last checked ${resource.updatedAt.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}. Updates automatically while this page is visible.`
          : "Checking your latest order status."}
      </p>
      {error && resource.data && (
        <div className="ui-message error mb-5" role="alert">
          <p>{error} Your last loaded orders are still shown.</p>
          <button
            className="ui-button ui-button-light mt-3"
            onClick={() => resource.refresh({ feedback: true })}
          >
            Try refreshing again
          </button>
        </div>
      )}
      <div
        className="order-tabs flex flex-wrap gap-2 my-7 mx-0 max-[760px]:gap-[6px]"
        role="group"
        aria-label="Filter orders"
      >
        {[
          ["all", "All orders"],
          ["unpaid", "Awaiting payment"],
          ["review", "Payment review"],
          ["progress", "In progress"],
          ["completed", "Completed"],
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
      {error && !resource.data ? (
        <div className="ui-empty" role="alert">
          <h2>Let’s try that again.</h2>
          <p>{error}</p>
          <button
            className="ui-button ui-button-dark"
            onClick={() => resource.refresh({ feedback: true })}
          >
            Reload orders
          </button>
        </div>
      ) : loading ? (
        <PageSkeleton variant="list" label="Finding your orders" />
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
            const awaitingPayment = isAwaitingPayment(order);
            return (
              <article
                className={`order-card ${targetOrder === order._id ? "ring-2 ring-forest ring-offset-4" : ""}`}
                id={`order-${order._id}`}
                key={order._id}
              >
                <header className="order-card-header">
                  <div>
                    <span>
                      ORDER{" "}
                      <span title={order.orderNumber}>
                        {shortOrderReference(order)}
                      </span>
                    </span>
                    <p>
                      Placed {dateLabel(order.orderDate || order.createdAt)}
                    </p>
                  </div>
                  <span className={`order-state ${order.status}`}>
                    {orderStatusLabel(order)}
                  </span>
                </header>
                <div className="order-card-body">
                  <OrderProgress
                    order={order}
                    compact
                    open={targetOrder === order._id}
                  />
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
                        className="ui-button ui-button-light"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              order.trackingNumber,
                            );
                            toast.success("Tracking number copied.");
                          } catch {
                            toast.info(
                              "Copy unavailable. Your tracking number is " + order.trackingNumber,
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
                    {["confirmed", "processing"].includes(order.status) && (
                      <p>
                        <Icon name="orders" size={17} />
                        {order.status === "confirmed"
                          ? "Your payment is verified. The store will prepare your pieces next."
                          : "Your pieces are being prepared. Your tracking number will appear here when they ship."}
                      </p>
                    )}
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
        <div className="ui-dialog-overlay fixed inset-0 z-[2000] flex items-center justify-center p-5 bg-[#17251cc2] [backdrop-filter:blur(4px)]">
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
