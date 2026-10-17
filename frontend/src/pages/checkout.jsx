import Image from "../components/Image";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
import { validateAddress } from "../utils/address";
import CustomerLayout from "../components/CustomerLayout";
import AddressFields from "../components/AddressFields";
import UploadField from "../components/UploadField";
import Icon from "../components/Icon";
import useCheckoutDraft from "../hooks/useCheckoutDraft";
import "../styles/auth-pages.css";

export default function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resumeOrder = params.get("order");
  const [checkoutId, setCheckoutId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadRetry, setLoadRetry] = useState(0);
  const [methods, setMethods] = useState({});
  const [quote, setQuote] = useState(null);
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [applying, setApplying] = useState(false);
  const userId = user?._id || user?.id;
  const [items, setItems] = useState([]);
  const [address, setAddress] = useState({});
  const [shipping, setShipping] = useState(null);
  const [shippingError, setShippingError] = useState("");
  const [shippingRetry, setShippingRetry] = useState(0);
  const [method, setMethod] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [order, setOrder] = useState(null);
  const [step, setStep] = useState("review");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [proof, setProof] = useState(null);
  const [failedQR, setFailedQR] = useState("");
  const locked = useRef(false);
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );
  const total = order?.total ?? quote?.total ?? subtotal + (shipping || 0);
  const paymentQR = (method) =>
    methods[method]?.enabled ? methods[method].qrUrl : "";
  const profile = useRef(user);
  useEffect(() => {
    profile.current = user;
  }, [user]);
  const draftSave = useCheckoutDraft(
    {
      checkoutId,
      shippingAddress: address,
      paymentMethod: method,
      discountCode: appliedCode,
    },
    !loading && !loadError && !!checkoutId && step === "review",
  );
  const draftError = draftSave.error;
  const qr = paymentQR(method);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    (async () => {
      try {
        const [response, payments] = await Promise.all([
          apiFetch(
            resumeOrder
              ? `${BACKEND_URL}/api/orders/${encodeURIComponent(resumeOrder)}`
              : `${BACKEND_URL}/api/checkout`,
            { signal: controller.signal },
          ),
          apiFetch(`${BACKEND_URL}/api/payments`, {
            signal: controller.signal,
          }),
        ]);
        const paymentData = await payments.json();
        if (!payments.ok)
          throw new Error(
            paymentData.error || "Payment methods could not be loaded.",
          );
        setMethods(paymentData.methods);
        const account = profile.current;
        const data = await response.json();
        if (response.status === 404 && !resumeOrder) {
          navigate("/cart", { replace: true });
          return;
        }
        if (!response.ok)
          throw new Error(data.error || "Checkout could not be loaded.");
        const draft = resumeOrder
          ? {
              items: data.order.items,
              pendingOrder: { ...data.order, orderId: data.order._id },
            }
          : data.checkout;
        if (!draft?.items?.length)
          throw new Error("This checkout is empty. Please review your bag.");
        if (
          draft.pendingOrder?.paymentProof ||
          (draft.pendingOrder &&
            !["pending", "pending_payment"].includes(draft.pendingOrder.status))
        ) {
          navigate("/order-history", { replace: true });
          return;
        }
        setCheckoutId(draft.checkoutId || "");
        setAppliedCode(draft.discountCode || "");
        setCode(draft.discountCode || "");
        setItems(draft.items);
        const delivery =
          draft.pendingOrder?.shippingAddress ||
          draft.shippingAddress ||
          account?.addresses?.find((item) => item.isDefault) ||
          account?.addresses?.[0] ||
          {};
        setAddress({
          recipient:
            delivery.recipient ||
            [account?.firstName, account?.lastName].filter(Boolean).join(" ") ||
            account?.username ||
            "",
          contact: delivery.contact || account?.phone || "",
          street: delivery.street || "",
          barangay: delivery.barangay || "",
          city: delivery.city || "",
          province: delivery.province || "",
        });
        setOrder(draft.pendingOrder || null);
        setMethod(
          draft.pendingOrder?.paymentMethod || draft.paymentMethod || "",
        );
        setStep(draft.pendingOrder ? "payment" : "review");
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userId, navigate, resumeOrder, loadRetry]);
  useEffect(() => {
    if (
      loading ||
      loadError ||
      !checkoutId ||
      !address.province ||
      step !== "review"
    )
      return;
    const controller = new AbortController();
    setShipping(null);
    setShippingError("");
    (async () => {
      try {
        const response = await apiFetch(`${BACKEND_URL}/api/checkout/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkoutId,
            province: address.province,
            discountCode: appliedCode,
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(data.error || "Shipping couldn’t be calculated. Please try again.");
        if (!controller.signal.aborted) {
          setShipping(Number(data.quote.shippingFee));
          setQuote(data.quote);
          setItems(data.quote.items);
        }
      } catch (failure) {
        if (!controller.signal.aborted) setShippingError(failure.message);
      }
    })();
    return () => controller.abort();
  }, [
    address.province,
    step,
    shippingRetry,
    checkoutId,
    appliedCode,
    loading,
    loadError,
  ]);
  const changeAddress = (key, value) => {
    setAddress((previous) => ({ ...previous, [key]: value }));
    setFields((previous) => ({ ...previous, [key]: "" }));
    setError("");
    if (key === "province") {
      setShipping(null);
      setQuote(null);
    }
  };
  const submitOrder = async (event) => {
    event.preventDefault();
    if (locked.current) return;
    const validation = validateAddress(address);
    setFields(validation);
    setError("");
    const first = Object.keys(validation)[0];
    if (first) {
      document.getElementById(`delivery-${first}`)?.focus();
      return;
    }
    if (!method || !qr || shipping === null || !agreed) {
      setError(
        "Choose an available payment method, review shipping, and confirm your order details to continue.",
      );
      return;
    }
    locked.current = true;
    setBusy(true);
    try {
      const payload = {
        userId,
        checkoutId,
        discountCode: appliedCode,
        items: items.map((item) => ({
          ...item,
          id: item.id || item._id,
          qty: Number(item.qty),
          price: Number(item.price),
        })),
        shippingAddress: address,
        paymentMethod: method,
        subtotal,
        shippingFee: shipping,
        total: quote?.total ?? subtotal + shipping,
      };
      const response = await apiFetch(`${BACKEND_URL}/api/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(
          data.error || "Your order couldn’t be created. Please try again.",
        );
      const saved = {
        ...payload,
        ...data.order,
        items: data.items || payload.items,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        total: data.total ?? payload.total,
        subtotal: data.subtotal ?? subtotal,
        shippingFee: data.shippingFee ?? shipping,
      };
      setItems(saved.items);
      setOrder(saved);
      setStep("payment");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (failure) {
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const upload = async (event) => {
    event.preventDefault();
    if (locked.current || !proof) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const data = new FormData();
      data.append("orderId", order.orderId);
      data.append("userId", userId);
      data.append("paymentProof", proof);
      const response = await apiFetch(
        `${BACKEND_URL}/api/orders/upload-payment-proof`,
        { method: "POST", body: data },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error || "The image couldn’t be submitted. Please try again.",
        );
      window.dispatchEvent(new Event("cart:changed"));
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (failure) {
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  if (loading)
    return (
      <CustomerLayout>
        <div className="ui-empty" role="status">
          Preparing your checkout…
        </div>
      </CustomerLayout>
    );
  if (loadError)
    return (
      <CustomerLayout>
        <div className="ui-empty" role="alert">
          <p>{loadError}</p>
          <button
            className="ui-button ui-button-dark"
            onClick={() => setLoadRetry((value) => value + 1)}
          >
            Try again
          </button>
          <Link className="ui-button ui-button-light" to="/cart">
            Back to your bag
          </Link>
        </div>
      </CustomerLayout>
    );
  if (step === "done")
    return (
      <CustomerLayout>
        <section className="checkout-success">
          <span className="checkout-success-icon">
            <Icon name="check" size={32} />
          </span>
          <span className="ui-eyebrow">A new chapter begins</span>
          <h1>Your order is on its way to being yours.</h1>
          <p>
            Your payment proof has been received. Our team will review it and
            update your order once payment is confirmed.
          </p>
          <div className="checkout-reference">
            <span>Order reference</span>
            <strong>{order.orderNumber}</strong>
          </div>
          <div className="checkout-success-actions">
            <Link to="/order-history" className="ui-button ui-button-dark">
              Follow your order <Icon name="arrow" />
            </Link>
            <Link to="/" className="ui-button ui-button-light">
              Keep browsing
            </Link>
          </div>
        </section>
      </CustomerLayout>
    );
  return (
    <CustomerLayout>
      <div className="customer-heading">
        <div>
          <span className="ui-eyebrow">Almost yours</span>
          <h1>Let’s bring it home.</h1>
          <p>
            {step === "review"
              ? "Review your delivery details and choose how you’d like to pay."
              : "Complete your payment, then share your proof below."}
          </p>
        </div>
        <Link
          className="customer-back"
          to={step === "review" ? "/cart" : "/order-history"}
        >
          <Icon name="back" size={16} />
          {step === "review" ? "Back to your bag" : "View your orders"}
        </Link>
      </div>
      <ol className="checkout-progress" aria-label="Checkout progress">
        {["Review & delivery", "Payment & proof", "Store verification"].map(
          (label, i) => (
            <li
              key={label}
              className={
                i === (step === "review" ? 0 : 1)
                  ? "current"
                  : i < (step === "review" ? 0 : 1)
                    ? "complete"
                    : ""
              }
              aria-current={
                i === (step === "review" ? 0 : 1) ? "step" : undefined
              }
            >
              <span>{i + 1}</span>
              {label}
            </li>
          ),
        )}
      </ol>
      {draftError && (
        <div className="ui-message error" role="alert">
          Your latest delivery changes were not saved. {draftError}
          <button
            className="ui-button ui-button-light"
            onClick={draftSave.retry}
          >
            Save again
          </button>
        </div>
      )}
      {error && (
        <div className="ui-message error" role="alert">
          {error}
        </div>
      )}
      <div className="customer-columns">
        <div>
          {step === "review" ? (
            <form id="checkout-review" onSubmit={submitOrder} noValidate>
              <section className="customer-panel">
                <div className="customer-panel-heading">
                  <h2>Delivery address</h2>
                  <Link to="/profile">Your saved address</Link>
                </div>
                <AddressFields
                  value={address}
                  onChange={changeAddress}
                  errors={fields}
                  disabled={busy}
                />
              </section>
              <section className="customer-panel">
                <h2>Choose how to pay</h2>
                <p>
                  Pay with your wallet app using the store’s QR code. We’ll ask
                  for a screenshot or photo of your payment confirmation.
                </p>
                <div className="payment-choices">
                  {["gcash", "paymaya"].map((value) => (
                    <label
                      key={value}
                      className={!paymentQR(value) ? "unavailable" : ""}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={value}
                        checked={method === value}
                        disabled={busy || !paymentQR(value)}
                        onChange={() => setMethod(value)}
                      />
                      <span>
                        <strong>{value === "gcash" ? "GCash" : "Maya"}</strong>
                        <small>
                          {paymentQR(value)
                            ? "Pay by QR code"
                            : "Currently unavailable"}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                {!paymentQR("gcash") && !paymentQR("paymaya") && (
                  <div className="ui-message">
                    Online payment is temporarily unavailable. Please{" "}
                    <a href="mailto:oldgoodsthrift@gmail.com">
                      contact the store
                    </a>{" "}
                    for help with your order.
                  </div>
                )}
              </section>
              <section className="customer-panel">
                <h2>One last look</h2>
                <p>
                  Payment proof is reviewed by our team. Your order remains
                  pending until payment is verified. Stock is checked again when
                  you submit your proof.
                </p>
                <label className="checkout-agreement">
                  <input
                    type="checkbox"
                    checked={agreed}
                    disabled={busy}
                    onChange={(event) => setAgreed(event.target.checked)}
                  />
                  I’ve checked my order and delivery details, and understand
                  that payment is verified by the store.
                </label>
              </section>
            </form>
          ) : (
            <>
              <section className="customer-panel">
                <span className="ui-eyebrow">Order {order.orderNumber}</span>
                <h2 className="checkout-payment-title">
                  A quick scan, then it’s over to us.
                </h2>
                <div className="checkout-payment">
                  <div className="checkout-qr">
                    {qr && failedQR !== qr ? (
                      <Image
                        src={qr}
                        onError={() => setFailedQR(qr)}
                        alt={`${method === "gcash" ? "GCash" : "Maya"} merchant payment QR code`}
                      />
                    ) : (
                      <p>
                        The payment QR code is unavailable. Contact the store
                        before transferring money.
                      </p>
                    )}
                  </div>
                  <div>
                    <p>
                      Open {method === "gcash" ? "GCash" : "Maya"} and scan the
                      merchant QR. Check the recipient in your app before you
                      confirm.
                    </p>
                    <p>
                      Recipient:{" "}
                      <strong>
                        {methods[method]?.merchantName ||
                          "Check the merchant in your wallet app"}
                      </strong>
                    </p>
                    <span className="ui-eyebrow">Amount to pay</span>
                    <strong className="checkout-pay-amount">
                      {formatPrice(order.total)}
                    </strong>
                    <p>
                      Use your order number as a reference when available.
                      Already paid? Upload your proof below.
                    </p>
                  </div>
                </div>
              </section>
              <form onSubmit={upload}>
                <section className="customer-panel">
                  <h2>Share your payment proof</h2>
                  <p>
                    Make sure the amount, date, and transaction reference are
                    readable. This helps us verify your payment.
                  </p>
                  <UploadField
                    file={proof}
                    onChange={setProof}
                    onError={setError}
                    disabled={busy}
                    label="Payment confirmation image"
                  />
                  <button
                    className="ui-button ui-button-dark"
                    type="submit"
                    disabled={busy || !proof}
                  >
                    {busy ? "Submitting your proof…" : "Submit payment proof"}
                    <Icon name="arrow" />
                  </button>
                </section>
              </form>
              <p className="checkout-draft-note">
                You can return to this payment step from your order history.
                Your order has already been created; submitting proof won’t
                create another order.
              </p>
            </>
          )}
        </div>
        <aside className="customer-summary">
          <span className="ui-eyebrow">Your good finds</span>
          <h2>Order summary</h2>
          <div className="checkout-summary-items">
            {items.map((item) => (
              <div key={item.id || item._id}>
                <Image src={item.image || "/product-placeholder.svg"} alt="" />
                <div>
                  <h3>{item.name}</h3>
                  <p>
                    Qty {item.qty}
                    {item.size ? ` · Size ${item.size}` : ""}
                  </p>
                </div>
                <strong>{formatPrice(Number(item.price) * item.qty)}</strong>
              </div>
            ))}
          </div>
          {step === "review" && (
            <form
              className="checkout-discount"
              onSubmit={async (event) => {
                event.preventDefault();
                if (applying || !address.province) return;
                setApplying(true);
                setDiscountError("");
                try {
                  const response = await apiFetch(
                    `${BACKEND_URL}/api/checkout/quote`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        checkoutId,
                        province: address.province,
                        discountCode: code,
                      }),
                    },
                  );
                  const data = await response.json();
                  if (!response.ok)
                    throw new Error(
                      data.error || "This code could not be applied.",
                    );
                  setQuote(data.quote);
                  setShipping(data.quote.shippingFee);
                  setItems(data.quote.items);
                  setAppliedCode(data.quote.discountCode);
                  setCode(data.quote.discountCode);
                } catch (error) {
                  setDiscountError(error.message);
                } finally {
                  setApplying(false);
                }
              }}
            >
              <label htmlFor="checkout-discount">
                Discount code <span className="field-optional">(optional)</span>
              </label>
              <div>
                <input
                  id="checkout-discount"
                  value={code}
                  maxLength={40}
                  disabled={busy || applying}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Enter a code"
                />
                <button
                  className="ui-button ui-button-light"
                  disabled={
                    busy || applying || !code.trim() || !address.province
                  }
                >
                  {applying ? "Applying..." : "Apply"}
                </button>
              </div>
              {appliedCode && (
                <p>
                  {appliedCode} applied.{" "}
                  <button
                    type="button"
                    disabled={busy || applying}
                    onClick={() => {
                      setAppliedCode("");
                      setCode("");
                      setDiscountError("");
                    }}
                  >
                    Remove
                  </button>
                </p>
              )}
              {discountError && (
                <p className="field-error" role="alert">
                  {discountError}
                </p>
              )}
            </form>
          )}
          <div className="summary-row">
            <span>Items subtotal</span>
            <span>{formatPrice(order?.subtotal ?? subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>
              {order
                ? formatPrice(order.shippingFee)
                : !address.province
                  ? "Choose a province"
                  : shipping === null
                    ? "Calculating…"
                    : formatPrice(shipping)}
            </span>
          </div>
          {shippingError && (
            <div className="ui-message error" role="alert">
              {shippingError}
              <button
                type="button"
                onClick={() => setShippingRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {(order?.discountAmount || quote?.discountAmount) > 0 && (
            <div className="summary-row">
              <span>Discount ({order?.discountCode || appliedCode})</span>
              <span>
                -{formatPrice(order?.discountAmount ?? quote?.discountAmount)}
              </span>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <strong>
              {shipping === null && !order ? "—" : formatPrice(total)}
            </strong>
          </div>
          {step === "review" && (
            <button
              type="submit"
              form="checkout-review"
              className="ui-button ui-button-dark"
              disabled={
                busy ||
                applying ||
                !agreed ||
                !method ||
                !paymentQR(method) ||
                shipping === null
              }
            >
              {busy ? "Checking your order…" : "Continue to payment"}
              <Icon name="arrow" size={18} />
            </button>
          )}
          <p className="summary-note">
            <Icon name="shield" size={18} />
            {step === "review"
              ? "Your order total is checked before you pay."
              : "Your order is pending until the store verifies your payment."}
          </p>
          {order && (
            <div className="checkout-delivery-summary">
              <strong>Delivering to</strong>
              <p>
                {address.recipient}
                <br />
                {address.contact}
                <br />
                {address.street}, {address.barangay}
                <br />
                {address.city}, {address.province}
              </p>
            </div>
          )}
        </aside>
      </div>
    </CustomerLayout>
  );
}
