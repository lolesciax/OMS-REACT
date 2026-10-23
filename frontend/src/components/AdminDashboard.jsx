import { toast } from "../services/feedback";
import TableScroll from "./TableScroll";
import PageSkeleton from "./PageSkeleton";
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
import { orderStatusLabel } from "../utils/orders";
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
const monthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const compactPriceFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
});
const statusLabel = (value) =>
  ({
    pending: "Payment & review",
    pending_payment: "Awaiting payment",
    confirmed: "Confirmed",
    processing: "Preparing",
    shipped: "Shipped",
    completed: "Completed",
  })[value] ||
  value ||
  "Unknown";

export default function AdminDashboard() {
  const palette = getComputedStyle(document.documentElement);
  const chartColors = {
    primary: palette.getPropertyValue("--color-charcoal").trim(),
    accent: palette.getPropertyValue("--color-tangerine").trim(),
    soft: palette.getPropertyValue("--color-cotton").trim(),
    muted: palette.getPropertyValue("--color-muted").trim(),
    line: palette.getPropertyValue("--color-line").trim(),
  };
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
      else {
        setUpdated(new Date());
        if (retry > 0) toast.success("Store overview refreshed.");
      }
      setLoading(false);
    })();
    return () => controller.abort();
  }, [retry]);
  if (loading)
    return (
      <AdminLayout
        title="Store overview"
        description="A clear look at your collection, orders, and the people giving them a new home."
        actions={
          <button className="ui-button ui-button-light" disabled>
            <Icon name="refresh" size={17} />
            Refresh overview
          </button>
        }
      >
        <PageSkeleton variant="dashboard" label="Loading store overview" />
      </AdminLayout>
    );
  const currentMonth = new Date();
  const revenueByMonth = new Map(
    monthly.map((item) => [String(item._id), item]),
  );
  const monthPoints = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 5 + index,
      1,
    );
    const record = revenueByMonth.get(monthKey(date));
    return {
      label: date.toLocaleDateString("en-PH", {
        month: "short",
        year: "2-digit",
      }),
      fullLabel: date.toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      }),
      revenue: Number(record?.revenue) || 0,
      orders: Number(record?.orders) || 0,
    };
  });
  const sixMonthRevenue = monthPoints.reduce(
    (total, item) => total + item.revenue,
    0,
  );
  const orderStatuses = overview.orderStatusDistribution || [];
  const totalOrdersByStatus = orderStatuses.reduce(
    (total, item) => total + (Number(item.count) || 0),
    0,
  );
  const lowStockProducts = overview.lowStockProducts || [];
  const soldOutCount = lowStockProducts.filter(
    (product) => Number(product.stock) <= 0,
  ).length;
  const revenue = {
    labels: monthPoints.map((item) => item.label),
    datasets: [
      {
        label: "Revenue",
        data: monthPoints.map((item) => item.revenue),
        borderColor: chartColors.primary,
        backgroundColor: chartColors.soft,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBorderWidth: 2,
        pointBorderColor: "#fff",
        pointBackgroundColor: monthPoints.map((item, index) =>
          index === monthPoints.length - 1
            ? chartColors.accent
            : chartColors.primary,
        ),
        fill: true,
        tension: 0.35,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          title: (items) =>
            monthPoints[items[0]?.dataIndex]?.fullLabel || "Revenue",
          label: (context) => `Revenue: ${formatPrice(context.parsed.y)}`,
          afterLabel: (context) => {
            const orders = monthPoints[context.dataIndex]?.orders || 0;
            return `${orders.toLocaleString()} completed ${orders === 1 ? "order" : "orders"}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: chartColors.muted,
          font: { size: 12, weight: "500" },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
        },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: chartColors.line },
        ticks: {
          color: chartColors.muted,
          font: { size: 12 },
          maxTicksLimit: 5,
          callback: (value) => compactPriceFormatter.format(Number(value)),
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
        backgroundColor: chartColors.soft,
        borderColor: chartColors.primary,
        borderWidth: 1,
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
          Refresh overview
        </button>
      }
    >
      <p className="admin-updated" role="status">
        {updated
          ? `Updated ${updated.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`
          : "Refresh to load your store figures."}
      </p>
      {error && (
        <div className="ui-message error" role="alert">
          {error}
        </div>
      )}
      <div className="admin-stat-grid dashboard-stat-grid">
        {[
          {
            label: "Products",
            value: stats?.productCount,
            note: "Pieces in your catalog",
            icon: "bag",
          },
          {
            label: "Orders",
            value: stats?.orderCount,
            note: "Orders received",
            icon: "orders",
          },
          {
            label: "Customers",
            value: stats?.customerCount,
            note: "Customer accounts",
            icon: "user",
          },
          {
            label: "Revenue",
            value: stats ? formatPrice(stats.revenueAmount) : null,
            note: "From completed orders",
            icon: "leaf",
          },
        ].map(({ label, value, note, icon }) => (
          <div
            className="admin-stat"
            data-stat={label.toLowerCase()}
            key={label}
          >
            <div className="admin-stat-label">
              <span>{label}</span>
              <span className="admin-stat-icon">
                <Icon name={icon} size={19} />
              </span>
            </div>
            <strong>
              {typeof value === "number"
                ? value.toLocaleString("en-PH")
                : (value ?? "—")}
            </strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="admin-dashboard-charts">
        <section className="admin-panel padded">
          <div className="admin-panel-title revenue-panel-title">
            <div>
              <h2>Revenue over time</h2>
              <p className="admin-panel-caption">
                Monthly completed-order revenue
              </p>
            </div>
            <div className="admin-revenue-summary">
              <span>Last 6 months</span>
              <strong>{formatPrice(sixMonthRevenue)}</strong>
            </div>
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
              <h3>Room for a good start.</h3>
              <p>
                Monthly revenue appears here when completed orders are recorded.
              </p>
            </div>
          )}
        </section>
        <section className="admin-panel padded dashboard-activity-card">
          <div className="admin-panel-title">
            <div>
              <h2>Order activity</h2>
              <p className="admin-panel-caption">
                {totalOrdersByStatus.toLocaleString("en-PH")}{" "}
                {totalOrdersByStatus === 1 ? "order" : "orders"} across all
                statuses
              </p>
            </div>
            <Link to="/admin/orders">
              View orders <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="admin-status-list">
            {orderStatuses.length ? (
              orderStatuses.map((item) => {
                const count = Number(item.count) || 0;
                const share =
                  totalOrdersByStatus > 0
                    ? (count / totalOrdersByStatus) * 100
                    : 0;
                return (
                  <div
                    className={`admin-status-row ${item._id}`}
                    key={item._id}
                  >
                    <div className="admin-status-row-heading">
                      <span>
                        <i className={item._id} aria-hidden="true" />
                        {statusLabel(item._id)}
                      </span>
                      <strong>{count.toLocaleString("en-PH")}</strong>
                    </div>
                    <div
                      className="admin-status-track"
                      role="progressbar"
                      aria-label={`${statusLabel(item._id)} orders`}
                      aria-valuemin={0}
                      aria-valuemax={Math.max(totalOrdersByStatus, 1)}
                      aria-valuenow={count}
                    >
                      <span style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="admin-status-empty">
                <span className="admin-status-empty-icon">
                  <Icon name="orders" size={20} />
                </span>
                <span>
                  <strong>No orders yet</strong>
                  <small>New orders will appear here.</small>
                </span>
              </div>
            )}
          </div>
          <Link className="admin-activity-link" to="/admin/orders">
            Open order queue <Icon name="arrow" size={17} />
          </Link>
        </section>
      </div>
      <section className="admin-panel">
        <div className="admin-panel-title dashboard-section-title">
          <h2>The latest orders</h2>
          <Link to="/admin/orders">See all orders ↗</Link>
        </div>
        <TableScroll label="Recent orders">
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
                    New orders will appear here.
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
                        {orderStatusLabel(order)}
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
        </TableScroll>
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
                      grid: { color: "#f0ebe7" },
                    },
                    y: {
                      grid: { display: false },
                      ticks: { font: { size: 14 }, color: chartColors.muted },
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
              Product activity appears here as orders come in.
            </div>
          )}
        </section>
        <section className="admin-panel padded dashboard-stock-card">
          <div className="admin-panel-title">
            <div>
              <h2>Keep an eye on these</h2>
              <p className="admin-panel-caption">
                Inventory running low or already sold out
              </p>
            </div>
            <Link to="/admin/products">
              Inventory <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="admin-stock-summary" role="status">
            <strong>{lowStockProducts.length.toLocaleString("en-PH")}</strong>
            <span>
              {lowStockProducts.length === 1 ? "piece needs" : "pieces need"}{" "}
              attention
            </span>
            {soldOutCount > 0 && (
              <span className="admin-stock-soldout">
                {soldOutCount} sold out
              </span>
            )}
          </div>
          <div className="admin-low-stock">
            {lowStockProducts.length ? (
              lowStockProducts.map((product) => {
                const stock = Number(product.stock) || 0;
                const soldOut = stock <= 0;
                return (
                  <div
                    className={`admin-low-stock-row ${soldOut ? "sold-out" : ""}`}
                    key={product._id}
                  >
                    <span
                      className="admin-low-stock-indicator"
                      aria-hidden="true"
                    />
                    <span className="admin-low-stock-copy">
                      <strong>{product.name}</strong>
                      <small>{product.category || "Pre-loved piece"}</small>
                    </span>
                    <span
                      className={`admin-badge ${soldOut ? "empty" : "low"}`}
                    >
                      {soldOut ? "Sold out" : `${stock} left`}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="admin-stock-clear">
                <span className="admin-stock-clear-icon">
                  <Icon name="check" size={19} />
                </span>
                <span>
                  <strong>Stock looks healthy</strong>
                  <small>No low-stock pieces to show right now.</small>
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
