import { shortOrderReference } from "../utils/orderProgress";
import Skeleton, { TableSkeleton } from "./Skeleton";
import TableScroll from "./TableScroll";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Pagination from "./Pagination";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
import { orderStatusLabel, isAwaitingPayment } from "../utils/orders";

const labels = {
  awaiting_payment: "Awaiting payment",
  payment_review: "Payment review",
  confirmed: "Confirmed",
  processing: "Preparing",
  shipped: "Shipped",
  completed: "Completed",
};
export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(`${BACKEND_URL}/api/admin/orders`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success)
          throw new Error(
            data.error || "Orders couldn’t be loaded. Please try again.",
          );
        setOrders(data.orders || []);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [retry]);
  const visible = useMemo(
    () =>
      orders.filter(
        (order) =>
          (status === "all" ||
            (status === "awaiting_payment"
              ? isAwaitingPayment(order)
              : status === "payment_review"
                ? ["pending", "pending_payment"].includes(order.status) &&
                  !!order.paymentProof
                : order.status === status)) &&
          [
            order.orderNumber,
            order.customerName,
            order.username,
            order._id,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(search.trim().toLowerCase()),
          ),
      ),
    [orders, status, search],
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(visible.length / 10)),
  );
  return (
    <AdminLayout
      title="Orders"
      description="Follow payments, prepare good finds, and keep customers in the loop."
      actions={
        <button
          className="ui-button ui-button-light"
          disabled={loading}
          onClick={() => setRetry((value) => value + 1)}
        >
          <Icon name="refresh" size={17} />
          Refresh
        </button>
      }
    >
      <div className="admin-stat-grid compact">
        {[
          ["All orders", orders.length],
          [
            "Awaiting review",
            orders.filter(
              (order) =>
                ["pending", "pending_payment"].includes(order.status) &&
                !!order.paymentProof,
            ).length,
          ],
          [
            "Preparing",
            orders.filter((order) =>
              ["confirmed", "processing"].includes(order.status),
            ).length,
          ],
          [
            "Shipped",
            orders.filter((order) => order.status === "shipped").length,
          ],
        ].map(([label, value]) => (
          <div className="admin-stat" key={label}>
            <span>{label}</span>
            <strong>
              {loading ? (
                <Skeleton className="my-1 h-8 w-20 max-w-full" />
              ) : (
                value
              )}
            </strong>
          </div>
        ))}
      </div>
      {error && (
        <div className="ui-message error" role="alert">
          {error}
        </div>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar flex items-center justify-between gap-5 py-5 px-[22px] border-b border-line max-[650px]:flex-wrap max-[650px]:p-4 max-[650px]:gap-[14px]">
          <div className="admin-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label="Search orders"
              placeholder="Search order number or customer…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TableScroll label="Customer orders">
          <table className="admin-table" aria-busy={loading}>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Placed</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton
                  columns={6}
                  label="Loading orders"
                  thumbnail={false}
                />
              ) : !visible.length ? (
                <tr>
                  <td colSpan={6} className="admin-table-empty">
                    {error
                      ? "Orders are unavailable. Try refreshing."
                      : search || status !== "all"
                        ? "No orders match your filters."
                        : "Orders will appear here when a customer checks out."}
                  </td>
                </tr>
              ) : (
                visible
                  .slice((currentPage - 1) * 10, currentPage * 10)
                  .map((order) => (
                    <tr key={order._id}>
                      <td>
                        <Link
                          className="admin-primary-link"
                          to={`/admin/view-orders/${order._id}`}
                        >
                          {shortOrderReference(order)}
                        </Link>
                      </td>
                      <td>
                        {order.customerName || order.username || "Customer"}
                      </td>
                      <td>
                        {order.orderDate
                          ? new Date(order.orderDate).toLocaleDateString(
                              "en-PH",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </td>
                      <td className="admin-number">
                        {formatPrice(order.total)}
                      </td>
                      <td>
                        <span className={`admin-badge ${order.status}`}>
                          {orderStatusLabel(order)}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="admin-table-action"
                          to={`/admin/view-orders/${order._id}`}
                        >
                          Review <Icon name="arrow" size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </TableScroll>
        <Pagination
          loading={loading}
          count={visible.length}
          page={currentPage}
          onChange={setPage}
        />
      </section>
    </AdminLayout>
  );
}
