import { toast } from "../services/feedback";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";
import {
  notificationCategories,
  notificationDestination,
  notificationTime,
} from "../utils/notifications";
import CustomerLayout from "../components/CustomerLayout";
import AdminLayout from "../components/AdminLayout";
import Skeleton, { SkeletonRegion } from "../components/Skeleton";
import Icon from "../components/Icon";

function NotificationInbox({ admin = false }) {
  const { user } = useAuth();
  const { unreadCount, refresh } = useNotifications();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [cursors, setCursors] = useState([null]);
  const [nextCursor, setNextCursor] = useState(null);
  const [asOf, setAsOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [retry, setRetry] = useState(0);
  const identity = user?._id;
  const cursor = cursors[cursors.length - 1];
  const requestedFeedback = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      setRefreshing(true);
      const query = new URLSearchParams({
        unread: String(filter === "unread"),
        category,
        limit: "20",
      });
      if (cursor) query.set("cursor", cursor);
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/notifications?${query}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok || data.success === false)
          throw new Error(
            data.error || "Your notifications could not be loaded.",
          );
        if (!controller.signal.aborted) {
          if (requestedFeedback.current)
            toast.success("Notifications refreshed.");
          requestedFeedback.current = false;
          setItems(data.notifications);
          setNextCursor(data.nextCursor);
          setAsOf(data.asOf);
          setError("");
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          requestedFeedback.current = false;
          setError(failure.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
        running = false;
      }
    };
    load();
    const timer = setInterval(load, 30000);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [identity, filter, category, cursor, retry]);
  const change = (key, value) => {
    if (key === "filter") setFilter(value);
    else setCategory(value);
    setCursors([null]);
    setLoading(true);

    setError("");
  };
  const mutate = async (id, read = true) => {
    if (busy) return false;
    setBusy(id);
    setError("");

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/notifications/${id === "all" ? "read-all" : `${id}/read`}`,
        {
          method: id === "all" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id === "all" ? { before: asOf } : { read }),
        },
      );
      const data = await response.json();
      if (!response.ok || data.success === false)
        throw new Error(data.error || "The notification could not be updated.");
      refresh();
      if (mounted.current) {
        reload();
        toast.success(
          id === "all"
            ? "All current notifications marked as read."
            : read
              ? "Notification marked as read."
              : "Notification marked as unread.",
        );
      }
      return true;
    } catch (failure) {
      if (mounted.current) setError(failure.message);
      return false;
    } finally {
      if (mounted.current) setBusy("");
    }
  };
  const content = (
    <>
      {!admin && (
        <div className="customer-heading flex flex-wrap items-center justify-between gap-4 mb-7">
          <div>
            <span className="ui-eyebrow">Your store updates</span>
            <h1>Notifications</h1>
            <p>Follow your orders and stay informed about your account.</p>
          </div>
          <Link to="/order-history" className="ui-button ui-button-light">
            <Icon name="orders" size={18} />
            View orders
          </Link>
        </div>
      )}
      <section
        className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"
        aria-label="Notification inbox"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface-soft p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white">
              <Icon name="bell" size={22} />
            </span>
            <div>
              <h2 className="text-lead font-semibold text-ink">Your inbox</h2>
              <p className="text-small text-muted">
                {unreadCount === 0
                  ? "You’re all caught up."
                  : `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="ui-button ui-button-light"
              disabled={refreshing || !!busy}
              onClick={() => {
                requestedFeedback.current = true;
                reload();
                refresh();
              }}
            >
              <Icon name="refresh" size={17} />
              Refresh
            </button>
            <button
              className="ui-button ui-button-dark"
              disabled={!unreadCount || !asOf || !!busy || loading}
              onClick={() => mutate("all")}
            >
              <Icon name="check" size={17} />
              {busy === "all" ? "Updating…" : "Mark all as read"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5 sm:px-6">
          <div
            className="flex gap-2"
            role="group"
            aria-label="Notification read status"
          >
            {[
              ["all", "All updates"],
              ["unread", "Unread"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`min-h-11 cursor-pointer rounded-lg border px-4 text-body font-semibold transition-colors ${filter === key ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:bg-primary-soft"}`}
                aria-pressed={filter === key}
                disabled={!!busy}
                onClick={() => change("filter", key)}
              >
                {label}
              </button>
            ))}
          </div>
          <label
            className="flex flex-wrap items-center gap-2 text-small font-medium text-muted"
            htmlFor="notification-category"
          >
            Category
            <select
              id="notification-category"
              className="min-h-11 max-w-full rounded-lg border border-line bg-white px-3 text-body text-ink"
              value={category}
              disabled={!!busy}
              onChange={(event) => change("category", event.target.value)}
            >
              <option value="all">All categories</option>
              {Object.entries(notificationCategories)
                .filter(
                  ([key]) =>
                    user?.isAdmin || !["store", "inventory"].includes(key),
                )
                .map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="px-5 sm:px-6">
          {error && (
            <div className="ui-message error my-4" role="alert">
              {error}
              <button
                className="ui-button ui-button-light ml-2"
                disabled={refreshing || !!busy}
                onClick={reload}
              >
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <SkeletonRegion label="Loading notifications">
              <div className="divide-y divide-line">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex gap-4 py-6">
                    <Skeleton className="size-11 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <Skeleton className="h-5 w-2/3 rounded" />
                      <Skeleton className="h-4 w-full rounded" />
                      <Skeleton className="h-4 w-1/3 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </SkeletonRegion>
          ) : !items.length && !error ? (
            <div className="mx-auto max-w-md py-14 text-center">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Icon name={filter === "unread" ? "check" : "bell"} size={30} />
              </span>
              <h3 className="mt-5 text-lead font-semibold">
                {filter === "unread" ? "All caught up" : "No updates here yet"}
              </h3>
              <p className="mt-3 text-body leading-relaxed text-muted">
                {category !== "all"
                  ? "Try another category to see more updates."
                  : "Order progress and account updates will appear here. We’ll keep the important details in one place."}
              </p>
              {(filter !== "all" || category !== "all") && (
                <button
                  className="ui-button ui-button-light mt-5"
                  onClick={() => {
                    setFilter("all");
                    setCategory("all");
                    setCursors([null]);
                    setLoading(true);
                  }}
                >
                  Show all updates
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-2 py-2" aria-label="Notifications">
              {items.map((item) => (
                <li
                  key={item._id}
                  className={`my-2 flex gap-3 rounded-xl p-4 sm:gap-4 sm:p-5 ${!item.readAt ? "border-l-4 border-leaf bg-sage/30" : "border-l-4 border-transparent"}`}
                >
                  <span
                    className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl ${!item.readAt ? "bg-white text-primary" : "bg-[#f3f3ed] text-muted"}`}
                  >
                    <Icon
                      name={
                        {
                          orders: "orders",
                          account: "shield",
                          inventory: "bag",
                          store: "settings",
                        }[item.category] || "bell"
                      }
                      size={20}
                    />
                  </span>
                  <div className="min-w-0 flex-1 break-words">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-small font-semibold text-primary">
                        {notificationCategories[item.category] || "Update"}
                      </span>
                      {item.audience === "admin" && (
                        <span className="rounded-full border border-line bg-white px-2 py-0.5 text-small text-muted">
                          Store team
                        </span>
                      )}
                      {!item.readAt && (
                        <span className="inline-flex items-center gap-1.5 text-small font-semibold text-primary">
                          <span className="size-2 rounded-full bg-primary" />
                          Unread
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-body font-semibold leading-relaxed text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-body leading-relaxed text-muted">
                      {item.message}
                    </p>
                    <time
                      className="mt-2 block text-small text-muted"
                      dateTime={item.createdAt}
                      title={new Date(item.createdAt).toLocaleString("en-PH")}
                    >
                      {notificationTime(item.createdAt)}
                    </time>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        className="ui-button ui-button-light"
                        to={notificationDestination(item.href, !!user?.isAdmin)}
                        onClick={() => {
                          if (!item.readAt) mutate(item._id);
                        }}
                      >
                        View{" "}
                        {item.category === "orders"
                          ? "order"
                          : item.category === "account"
                            ? "account"
                            : "details"}
                        <Icon name="arrow" size={16} />
                      </Link>
                      <button
                        className="ui-button ui-button-light"
                        disabled={!!busy}
                        onClick={() => mutate(item._id, !item.readAt)}
                      >
                        {busy === item._id
                          ? "Updating…"
                          : item.readAt
                            ? "Mark unread"
                            : "Mark read"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
          <p className="text-small text-muted" aria-live="polite">
            {refreshing && !loading
              ? "Refreshing updates…"
              : `Page ${cursors.length} · Updates refresh automatically`}
          </p>
          <div className="flex gap-2">
            <button
              className="ui-button ui-button-light"
              disabled={cursors.length === 1 || refreshing || !!busy}
              onClick={() => {
                setCursors((previous) => previous.slice(0, -1));
                setLoading(true);
              }}
            >
              Newer
            </button>
            <button
              className="ui-button ui-button-light"
              disabled={!nextCursor || refreshing || !!busy}
              onClick={() => {
                setCursors((previous) => [...previous, nextCursor]);
                setLoading(true);
              }}
            >
              Older
            </button>
          </div>
        </div>
      </section>
    </>
  );
  return admin ? (
    <AdminLayout
      title="Notifications"
      description="Review order activity, inventory warnings, and account updates."
    >
      {content}
    </AdminLayout>
  ) : (
    <CustomerLayout>{content}</CustomerLayout>
  );
}

export default function Notifications({ admin = false }) {
  const { user } = useAuth();
  return (
    <NotificationInbox key={`${user?._id}:${user?.isAdmin}`} admin={admin} />
  );
}
