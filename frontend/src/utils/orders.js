const nextStatus = {
  pending_payment: "pending",
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "completed",
};

export function canTransition(order, status) {
  return (
    nextStatus[order.status] === status &&
    (status !== "confirmed" || !!order.paymentProof)
  );
}
