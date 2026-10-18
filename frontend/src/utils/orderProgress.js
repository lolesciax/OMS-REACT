import { isAwaitingPayment } from "./orders.js";

export function progressState(order) {
  const known = [
    "pending_payment",
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "completed",
  ].includes(order?.status);
  if (!known)
    return {
      current: -1,
      title: "Status unavailable",
      detail: "Refresh this order to check its latest progress.",
    };
  if (isAwaitingPayment(order))
    return {
      current: 1,
      title: "Awaiting your payment",
      detail:
        "Complete payment and submit a readable proof. Unpaid orders do not reserve stock.",
    };
  if (["pending", "pending_payment"].includes(order.status))
    return {
      current: 2,
      title: "Payment is being reviewed",
      detail:
        "Your proof was received. The store will verify it before preparing your order.",
    };
  if (order.status === "confirmed")
    return {
      current: 3,
      title: "Payment verified",
      detail: "Your payment is confirmed. Preparation is the next step.",
    };
  if (order.status === "processing")
    return {
      current: 3,
      title: "Preparing your order",
      detail: "Your pieces are being checked and packed for shipment.",
    };
  if (order.status === "shipped")
    return {
      current: 4,
      title: "Your order is on its way",
      detail:
        "Use the tracking number below. Confirm receipt after your parcel arrives.",
    };
  return {
    current: 5,
    title: order.autoCompletedAt
      ? "Order completed automatically"
      : "Delivery completed",
    detail: order.autoCompletedAt
      ? "This order completed after 10 days in transit. Contact the store if your delivery has not arrived."
      : "Your order is complete. Contact the store if you need help with your purchase.",
  };
}

export function progressSteps(order) {
  return [
    { label: "Order placed", at: order.createdAt || order.orderDate },
    { label: "Payment proof", at: order.paymentProofUploadedAt },
    { label: "Payment review", at: order.confirmedAt },
    { label: "Preparing", at: order.processingAt },
    { label: "Shipped", at: order.shippedAt },
    {
      label: order.autoCompletedAt ? "Completed" : "Delivered",
      at: order.receiptConfirmedAt || order.completedAt,
    },
  ];
}

export const shortOrderReference = (order) =>
  order.orderNumber && order.orderNumber.length <= 28
    ? order.orderNumber
    : `#${String(order._id || order.orderId || "")
        .slice(-8)
        .toUpperCase()}`;
