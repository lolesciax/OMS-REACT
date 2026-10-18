const nextStatus = {
  pending_payment: "pending",
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "completed",
};

export const isAwaitingPayment = (order) =>
  ["pending", "pending_payment"].includes(order?.status) &&
  !order?.paymentProof;

export function orderStatusLabel(order) {
  if (isAwaitingPayment(order)) return "Awaiting payment";
  if (order?.status === "completed" && order.autoCompletedAt)
    return "Completed automatically";
  return (
    {
      pending: "Payment review",
      pending_payment: "Payment review",
      confirmed: "Payment confirmed",
      processing: "Preparing",
      shipped: "Shipped",
      completed: "Delivered",
    }[order?.status] ||
    order?.status ||
    "Unknown"
  );
}

export function canTransition(order, status) {
  return (
    nextStatus[order.status] === status &&
    (!["pending", "confirmed"].includes(status) || !!order.paymentProof)
  );
}
