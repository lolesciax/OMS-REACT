import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import AdminLayout from "./AdminLayout";
import Icon from "./Icon";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { formatPrice } from "../utils/catalog";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
);
const statusLabel = (value) =>
  ({
    pending: "Payment review",
    pending_payment: "Awaiting payment",
    confirmed: "Confirmed",
    processing: "Preparing",
    shipped: "Shipped",
    completed: "Completed",
  })[value] ||
  value ||
  "Unknown";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState({});
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [updated, setUpdated] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const request = async (path) => {
      const response = await apiFetch(`${BACKEND_URL}/api/admin/${path}`, {
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || data.success === false)
        throw new Error("Dashboard data unavailable");
      return data;
    };
    (async () => {
      const results = await Promise.allSettled(
        ["stats", "dashboard-data", "monthly-revenue"].map(request),
      );
      if (controller.signal.aborted) return;
      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setOverview(results[1].value);
      if (results[2].status === "fulfilled")
        setMonthly(results[2].value.monthlyRevenue || []);
      if (results.some((result) => result.status === "rejected"))
        setError(
          "Some dashboard information couldn’t be refreshed. Refresh to try again; any figures already shown may be out of date.",
        );
      else setUpdated(new Date());
      setLoading(false);
    })();
    return () => controller.abort();
  }, [retry]);
  const revenue = {
    labels: monthly.map((item) => {
      const [year, month] = String(item._id).split("-");
      return new Date(Number(year), Number(month) - 1).toLocaleDateString(
        "en-PH",
        { month: "short", year: "2-digit" },
      );
    }),
    datasets: [
      {
        label: "Revenue",
        data: monthly.map((item) => Number(item.revenue) || 0),
        borderColor: "#536f4d",
        backgroundColor: "#dce8d35e",
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: "#536f4d",
        fill: true,
        tension: 0.25,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (context) => formatPrice(context.parsed.y) },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#7b8570", font: { size: 14 } },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: "#eef0e7" },
        ticks: {
          color: "#7b8570",
          font: { size: 14 },
          callback: (value) => `₱${Number(value).toLocaleString()}`,
        },
      },
    },
  };
  const best = overview.topSellingProducts || [];
  const bestData = {
    labels: best.map((item) => item._id || "Untitled piece"),
    datasets: [
      {
        label: "Pieces ordered",
        data: best.map((item) => item.totalSold || 0),
        backgroundColor: "#b8c9a6",
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };
  return (
    <AdminLayout
      title="Store overview"
      description="A clear look at your collection, orders, and the people giving them a new home."
      actions={
        <button
          className="ui-button ui-button-light"
          disabled={loading}
          onClick={() => setRetry((value) => value + 1)}
        >
          <Icon name="refresh" size={17} />
          {loading ? "Refreshing…" : "Refresh overview"}
        </button>
      }
    >
      <p className="admin-updated" role="status">
        {loading
          ? "Getting the latest figures…"
          : updated
            ? `Updated ${updated.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`
            : "Refresh to load your store figures."}
      </p>
      {error && (
        <div className="ui-message error" role="alert">
          {error}
        </div>
      )}
      <div className="admin-stat-grid">
        {[
          ["Products", stats?.productCount, "In the catalog", "bag"],
          ["Orders", stats?.orderCount, "Recorded orders", "orders"],
          ["Customers", stats?.customerCount, "Customer accounts", "user"],
          [
            "Revenue",
            stats ? formatPrice(stats.revenueAmount) : null,
            "Completed orders only",
            "leaf",
          ],
        ].map(([label, value, note, icon]) => (
          <div className="admin-stat" key={label}>
            <div className="admin-stat-label">
              <span>{label}</span>
              <Icon name={icon} size={17} />
            </div>
            <strong>{value ?? "—"}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="admin-dashboard-charts">
        <section className="admin-panel padded">
          <div className="admin-panel-title">
            <h2>Revenue, over time.</h2>
            <span>Completed orders</span>
          </div>
          {monthly.length ? (
            <div className="admin-chart">
              <Line
                data={revenue}
                options={options}
                role="img"
                aria-label={`Recorded monthly revenue: ${monthly.map((item) => `${item._id}: ${formatPrice(item.revenue)}`).join(", ")}`}
              />
            </div>
          ) : (
            <div className="admin-state">
              <Icon name="leaf" size={30} />
              <h3>{loading ? "Loading revenue…" : "Room for a good start."}</h3>
              <p>
                Monthly revenue appears here when completed orders are recorded.
              </p>
            </div>
          )}
        </section>
        <section className="admin-panel padded">
          <div className="admin-panel-title">
            <h2>Order activity</h2>
            <Link to="/admin/orders">View orders ↗</Link>
          </div>
          <div className="admin-status-list">
            {(overview.orderStatusDistribution || []).length ? (
              (overview.orderStatusDistribution || []).map((item) => (
                <div key={item._id}>
                  <span>
                    <i className={item._id} />
                    {statusLabel(item._id)}
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))
            ) : (
              <div className="admin-state">
                {loading ? "Loading order activity…" : "No order activity yet."}
              </div>
            )}
          </div>
          <Link className="admin-activity-link" to="/admin/orders">
            Review your order queue <Icon name="arrow" size={17} />
          </Link>
        </section>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-title dashboard-section-title">
          <h2>The latest orders</h2>
          <Link to="/admin/orders">See all orders ↗</Link>
        </div>
        <div
          className="admin-table-scroll"
          tabIndex={0}
          aria-label="Recent orders table"
        >
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!(overview.recentOrders || []).length ? (
                <tr>
                  <td colSpan={5} className="admin-table-empty">
                    {loading
                      ? "Loading recent orders…"
                      : "New orders will appear here."}
                  </td>
                </tr>
              ) : (
                (overview.recentOrders || []).map((order) => (
                  <tr key={order._id}>
                    <td>
                      <Link
                        className="admin-primary-link"
                        to={`/admin/view-orders/${order._id}`}
                      >
                        {order.orderNumber || order._id.slice(-6)}
                      </Link>
                    </td>
                    <td>
                      {order.customerName || order.username || "Customer"}
                    </td>
                    <td className="admin-number">{formatPrice(order.total)}</td>
                    <td>
                      <span className={`admin-badge ${order.status}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="admin-table-action"
                        to={`/admin/view-orders/${order._id}`}
                      >
                        Open <Icon name="arrow" size={15} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <div className="admin-dashboard-charts lower">
        <section className="admin-panel padded">
          <div className="admin-panel-title">
            <h2>Most ordered pieces</h2>
            <span>Across recorded orders</span>
          </div>
          {best.length ? (
            <div className="admin-chart">
              <Bar
                data={bestData}
                options={{
                  ...options,
                  indexAxis: "y",
                  plugins: { legend: { display: false } },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: { precision: 0, font: { size: 14 } },
                      grid: { color: "#eef0e7" },
                    },
                    y: {
                      grid: { display: false },
                      ticks: { font: { size: 14 }, color: "#64725a" },
                    },
                  },
                }}
                role="img"
                aria-label={best
                  .map(
                    (item) => `${item._id}: ${item.totalSold} pieces ordered`,
                  )
                  .join(", ")}
              />
            </div>
          ) : (
            <div className="admin-state">
              {loading
                ? "Loading product activity…"
                : "Product activity appears here as orders come in."}
            </div>
          )}
        </section>
        <section className="admin-panel padded">
          <div className="admin-panel-title">
            <h2>Keep an eye on these.</h2>
            <Link to="/admin/products">Inventory ↗</Link>
          </div>
          <p className="admin-help">Pieces with fewer than 10 available.</p>
          <div className="admin-low-stock">
            {(overview.lowStockProducts || []).length ? (
              (overview.lowStockProducts || []).map((product) => (
                <div key={product._id}>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.category || "Pre-loved piece"}</small>
                  </span>
                  <span
                    className={`admin-badge ${product.stock > 0 ? "low" : "empty"}`}
                  >
                    {product.stock > 0 ? `${product.stock} left` : "Sold out"}
                  </span>
                </div>
              ))
            ) : (
              <div className="admin-state">
                {loading ? "Checking stock…" : "No low-stock pieces to show."}
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
