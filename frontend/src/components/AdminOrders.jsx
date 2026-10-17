import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import Pagination from "./Pagination";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";

const labels = {
  pending: "Payment review",
  pending_payment: "Awaiting payment",
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
  const visible = orders.filter(
    (order) =>
      (status === "all" || order.status === status) &&
      [order.orderNumber, order.customerName, order.username, order._id].some(
        (value) =>
          String(value || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
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
            orders.filter((order) =>
              ["pending", "pending_payment"].includes(order.status),
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
            <strong>{loading ? "—" : value}</strong>
          </div>
        ))}
      </div>
      {error && (
        <div className="ui-message error" role="alert">
          {error}
        </div>
      )}
      <section className="admin-panel">
        <div className="admin-toolbar">
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
        <div
          className="admin-table-scroll"
          tabIndex={0}
          aria-label="Orders table, scroll horizontally on smaller screens"
        >
          <table className="admin-table">
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
                <tr>
                  <td colSpan={6} className="admin-table-empty" role="status">
                    Loading orders…
                  </td>
                </tr>
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
                visible.slice((page - 1) * 10, page * 10).map((order) => (
                  <tr key={order._id}>
                    <td>
                      <Link
                        className="admin-primary-link"
                        to={`/admin/view-orders/${order._id}`}
                      >
                        {order.orderNumber || order._id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td>
                      {order.customerName || order.username || "Customer"}
                    </td>
                    <td>
                      {order.orderDate
                        ? new Date(order.orderDate).toLocaleDateString(
                            "en-PH",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "—"}
                    </td>
                    <td className="admin-number">{formatPrice(order.total)}</td>
                    <td>
                      <span className={`admin-badge ${order.status}`}>
                        {order.status === "pending" && !order.paymentProof
                          ? "Awaiting payment"
                          : labels[order.status] || order.status}
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
        </div>
        <Pagination count={visible.length} page={page} onChange={setPage} />
      </section>
    </AdminLayout>
  );
}
