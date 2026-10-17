import Image from "./Image";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import ConfirmDialog from "./ConfirmDialog";
import EditorDialog from "./EditorDialog";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
import { canTransition } from "../utils/orders";

const steps = ["pending", "confirmed", "processing", "shipped", "completed"];
const labels = {
  pending: "Payment review",
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Preparing",
  shipped: "Shipped",
  completed: "Completed",
};
const next = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "completed",
};
const actionLabels = {
  confirmed: "Verify payment & confirm",
  processing: "Start preparing",
  shipped: "Mark as shipped",
  completed: "Mark as completed",
};

export default function AdminViewOrders() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tracking, setTracking] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(
          `${BACKEND_URL}/api/admin/orders/${orderId}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok || !data.success || !data.order)
          throw new Error(
            data.error || "This order couldn’t be loaded. Please try again.",
          );
        setOrder(data.order);
        setTracking(data.order.trackingNumber || "");
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [orderId, retry]);
  const update = async (status) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await apiFetch(
        `${BACKEND_URL}/api/admin/orders/${orderId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...(status === "shipped"
              ? { trackingNumber: tracking.trim() }
              : {}),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "The order couldn’t be updated.");
      setOrder((previous) => ({
        ...previous,
        ...data.order,
        status,
        ...(status === "shipped" ? { trackingNumber: tracking.trim() } : {}),
      }));
      setConfirm(null);
      setMessage(`Order updated: ${labels[status].toLowerCase()}.`);
    } catch (failure) {
      setConfirm(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const delivery = (() => {
    if (!order?.shippingAddress) return {};
    if (typeof order.shippingAddress === "object") return order.shippingAddress;
    try {
      return JSON.parse(order.shippingAddress);
    } catch {
      return { street: order.shippingAddress };
    }
  })();
  const target = next[order?.status];
  const current = Math.max(0, steps.indexOf(order?.status));
  return (
    <AdminLayout
      title="Order details"
      description="Review the payment, check the details, and guide this order to its next step."
      actions={
        <Link className="ui-button ui-button-light" to="/admin/orders">
          <Icon name="back" size={17} />
          All orders
        </Link>
      }
    >
      {error && (
        <div className="ui-message error" role="alert">
          {error}
          {!order && (
            <button
              className="ui-button ui-button-light"
              onClick={() => setRetry((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {message && (
        <div className="ui-message success" role="status">
          {message}
        </div>
      )}
      {loading ? (
        <div className="admin-state" role="status">
          Loading order details…
        </div>
      ) : (
        order && (
          <>
            <div className="admin-order-banner">
              <div>
                <span className="ui-eyebrow">Order reference</span>
                <strong>{order.orderNumber || order._id}</strong>
                <small>
                  Placed{" "}
                  {new Date(order.orderDate || order.createdAt).toLocaleString(
                    "en-PH",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    },
                  )}
                </small>
              </div>
              <span className={`admin-badge ${order.status}`}>
                {labels[order.status] || order.status}
              </span>
            </div>
            <ol
              className="admin-order-progress"
              aria-label="Fulfillment progress"
            >
              {steps.map((status, index) => (
                <li
                  key={status}
                  className={index <= current ? "reached" : ""}
                  aria-current={index === current ? "step" : undefined}
                >
                  <span>
                    {index < current ? (
                      <Icon name="check" size={14} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {labels[status]}
                </li>
              ))}
            </ol>
            <div className="admin-detail-columns">
              <div>
                <section className="admin-panel padded">
                  <div className="admin-panel-title">
                    <h2>Items in this order</h2>
                    <span>
                      {(order.items || []).reduce(
                        (sum, item) => sum + Number(item.qty),
                        0,
                      )}{" "}
                      pieces
                    </span>
                  </div>
                  <div className="admin-order-items">
                    {(order.items || []).map((item, index) => (
                      <div key={item.id || index}>
                        <Image src={item.image} alt={item.name} />
                        <div>
                          <h3>{item.name}</h3>
                          <p>
                            Qty {item.qty}
                            {item.size ? ` · Size ${item.size}` : ""}
                            {item.condition ? ` · ${item.condition}` : ""}
                          </p>
                          <small>{formatPrice(item.price)} each</small>
                        </div>
                        <strong>
                          {formatPrice(Number(item.price) * item.qty)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="admin-totals">
                    <div>
                      <span>Items subtotal</span>
                      <span>{formatPrice(order.subtotal)}</span>
                    </div>
                    <div>
                      <span>Shipping</span>
                      <span>{formatPrice(order.shippingFee)}</span>
                    </div>
                    <div>
                      <strong>Total</strong>
                      <strong>{formatPrice(order.total)}</strong>
                    </div>
                  </div>
                </section>
                <section className="admin-panel padded">
                  <div className="admin-panel-title">
                    <h2>Payment proof</h2>
                    <span>
                      {order.paymentMethod === "paymaya"
                        ? "Maya"
                        : order.paymentMethod === "gcash"
                          ? "GCash"
                          : order.paymentMethod || "—"}
                    </span>
                  </div>
                  {order.paymentProof ? (
                    <>
                      <button
                        className="admin-proof-preview"
                        onClick={() => setPreview(true)}
                        aria-label="Enlarge payment proof"
                      >
                        <Image
                          src={order.paymentProof}
                          alt="Customer-submitted payment confirmation"
                        />
                        <span>
                          <Icon name="eye" size={17} />
                          View full image
                        </span>
                      </button>
                      <p className="admin-help">
                        Check the recipient, amount, date, and transaction
                        reference against your payment records before
                        confirming.
                      </p>
                    </>
                  ) : (
                    <div className="admin-state">
                      <Icon name="shield" size={30} />
                      <h3>No payment proof yet.</h3>
                      <p>
                        The customer can return to their order to finish payment
                        and submit proof.
                      </p>
                    </div>
                  )}
                </section>
              </div>
              <aside>
                <section className="admin-panel padded">
                  <h2>Next step</h2>
                  {target && canTransition(order, target) ? (
                    <>
                      <p className="admin-help">
                        {target === "confirmed"
                          ? "Confirm only after checking the payment in your merchant wallet."
                          : target === "processing"
                            ? "Payment is confirmed. Let the customer know their pieces are being prepared."
                            : target === "shipped"
                              ? "Add the shipment tracking number before marking the order as shipped."
                              : "Confirm that the order has been delivered before completing it."}
                      </p>
                      {target === "shipped" && (
                        <div className="ui-field">
                          <label htmlFor="tracking-number">
                            Tracking number
                          </label>
                          <input
                            id="tracking-number"
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={12}
                            value={tracking}
                            onChange={(event) =>
                              setTracking(event.target.value.replace(/\D/g, ""))
                            }
                            disabled={busy}
                          />
                          <p className="ui-field-hint">
                            Enter the 12-digit tracking number.
                          </p>
                        </div>
                      )}
                      <button
                        className="ui-button ui-button-dark admin-full-button"
                        disabled={
                          busy ||
                          (target === "shipped" && !/^\d{12}$/.test(tracking))
                        }
                        onClick={() =>
                          ["confirmed", "completed"].includes(target)
                            ? setConfirm(target)
                            : update(target)
                        }
                      >
                        {busy ? "Updating…" : actionLabels[target]}
                        <Icon name="arrow" size={17} />
                      </button>
                    </>
                  ) : (
                    <div className="admin-notice">
                      {order.status === "completed"
                        ? "This order is complete. No further action is needed."
                        : !order.paymentProof
                          ? "Awaiting the customer’s payment proof. Confirming an order is available after proof is submitted."
                          : "There is no available status change for this order."}
                    </div>
                  )}
                  {order.trackingNumber && (
                    <div className="admin-tracking">
                      <span>Tracking number</span>
                      <strong>{order.trackingNumber}</strong>
                    </div>
                  )}
                </section>
                <section className="admin-panel padded">
                  <h2>Deliver to</h2>
                  <dl className="admin-customer-details">
                    <dt>Recipient</dt>
                    <dd>
                      {delivery.recipient ||
                        order.name ||
                        order.customerName ||
                        order.username ||
                        "Customer"}
                    </dd>
                    <dt>Mobile number</dt>
                    <dd>{delivery.contact || order.phone || "Not provided"}</dd>
                    <dt>Address</dt>
                    <dd>
                      {[
                        delivery.street,
                        delivery.barangay,
                        delivery.city,
                        delivery.province,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Not provided"}
                    </dd>
                    {order.email && (
                      <>
                        <dt>Email</dt>
                        <dd>
                          <a href={`mailto:${order.email}`}>{order.email}</a>
                        </dd>
                      </>
                    )}
                  </dl>
                </section>
              </aside>
            </div>
          </>
        )
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "confirmed"
              ? "Confirm this payment?"
              : "Complete this order?"
          }
          description={
            confirm === "confirmed"
              ? `Confirm that the ${formatPrice(order.total)} payment matches your merchant records. The order will move to confirmed.`
              : "The order will be marked as completed. Continue once delivery is confirmed."
          }
          confirmLabel={
            confirm === "confirmed" ? "Payment verified" : "Complete order"
          }
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() => update(confirm)}
        />
      )}{" "}
      {preview && (
        <EditorDialog
          title="Payment confirmation"
          onClose={() => setPreview(false)}
          wide
        >
          <Image
            className="admin-proof-full"
            src={order.paymentProof}
            alt="Full payment confirmation submitted by the customer"
          />
        </EditorDialog>
      )}
    </AdminLayout>
  );
}
