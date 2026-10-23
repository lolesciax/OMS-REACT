import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";
import { toast } from "../services/feedback";
import {
  notificationDestination,
  notificationTime,
} from "../utils/notifications";
import Icon from "./Icon";

export default function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, notifications, loading, error, refresh } =
    useNotifications();
  const [openedAt, setOpenedAt] = useState(null);
  const [position, setPosition] = useState({ top: 80, right: 12 });
  const location = useLocation();
  const button = useRef(null);
  const panel = useRef(null);
  const open = !!user && openedAt === location.key;
  const close = () => setOpenedAt(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current.getBoundingClientRect();
      setPosition({
        top: Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 160)),
        right: Math.max(
          12,
          Math.min(
            window.innerWidth - rect.right,
            window.innerWidth - Math.min(384, window.innerWidth - 24) - 12,
          ),
        ),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector("button, a")?.focus({ preventScroll: true });
    const outside = (event) => {
      if (
        !button.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        setOpenedAt(null);
    };
    const escape = (event) => {
      if (event.key === "Escape") {
        setOpenedAt(null);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const read = async (item) => {
    close();
    if (item.readAt) return;
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/notifications/${item._id}/read`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        },
      );
      const data = await response.json();
      if (!response.ok || data.success === false)
        throw Error(data.error || "Could not mark the notification as read.");
      refresh();
    } catch (failure) {
      toast.info(failure.message);
    }
  };

  if (!user) return null;
  return (
    <>
      <button
        ref={button}
        type="button"
        className="notification-bell relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-primary shadow-sm hover:bg-primary-soft hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        aria-controls={open ? "notification-dropdown" : undefined}
        onClick={() => {
          setOpenedAt(open ? null : location.key);
          if (!open) refresh();
        }}
      >
        <Icon name="bell" size={21} />
        {loading ? (
          <span className="skeleton absolute -right-1 -top-1 size-4 rounded-full" />
        ) : (
          unreadCount > 0 && (
            <span
              className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white ring-2 ring-paper"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )
        )}
      </button>
      {open &&
        createPortal(
          <section
            ref={panel}
            id="notification-dropdown"
            aria-label="Recent notifications"
            style={{
              ...position,
              maxHeight: `calc(100dvh - ${position.top + 12}px)`,
            }}
            className="fixed z-[2100] flex w-96 max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line p-4">
              <div>
                <h2 className="text-body font-semibold">Notifications</h2>
                <p className="text-small text-muted">
                  {unreadCount
                    ? `${unreadCount} unread updates`
                    : "You’re all caught up"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  close();
                  button.current?.focus();
                }}
                aria-label="Close notifications"
                className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-primary-soft"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              {error && (
                <div
                  role="alert"
                  className="border-b border-line p-4 text-small"
                >
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={refresh}
                    className="mt-2 min-h-11 rounded-lg border border-line px-3 font-semibold text-primary hover:bg-primary-soft"
                  >
                    Try again
                  </button>
                </div>
              )}
              {loading ? (
                <div
                  aria-label="Loading notifications"
                  aria-busy="true"
                  className="space-y-4 p-4"
                >
                  {[0, 1, 2].map((key) => (
                    <div key={key} className="space-y-2">
                      <span className="skeleton h-4 w-2/3" />
                      <span className="skeleton h-3 w-full" />
                      <span className="skeleton h-3 w-1/3" />
                    </div>
                  ))}
                </div>
              ) : notifications.length ? (
                <ul className="divide-y divide-line">
                  {notifications.map((item) => (
                    <li key={item._id}>
                      <Link
                        to={notificationDestination(item.href, !!user.isAdmin)}
                        onClick={() => {
                          void read(item);
                        }}
                        className={`flex min-h-20 items-start gap-3 p-4 no-underline transition-colors hover:bg-primary-soft focus-visible:-outline-offset-2 ${item.readAt ? "bg-white" : "bg-primary/5"}`}
                      >
                        <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                          <Icon name="bell" size={18} />
                        </span>
                        <span className="min-w-0 flex-1 break-words">
                          <span
                            className={`block text-small text-ink ${item.readAt ? "font-medium" : "font-semibold"}`}
                          >
                            {item.title}
                          </span>
                          <span className="mt-1 block text-small leading-relaxed text-muted">
                            {item.message}
                          </span>
                          <time
                            dateTime={item.createdAt}
                            className="mt-2 block text-small text-muted"
                          >
                            {notificationTime(item.createdAt)}
                          </time>
                        </span>
                        {!item.readAt && (
                          <span className="mt-2 size-2 shrink-0 rounded-full bg-accent">
                            <span className="sr-only">Unread</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                !error && (
                  <div className="px-6 py-9 text-center">
                    <Icon
                      name="bell"
                      size={28}
                      className="mx-auto text-primary"
                    />
                    <p className="mt-3 font-semibold">No notifications yet</p>
                    <p className="mt-1 text-small leading-relaxed text-muted">
                      Order and account updates will appear here.
                    </p>
                  </div>
                )
              )}
            </div>
            <Link
              to={user.isAdmin ? "/admin/notifications" : "/notifications"}
              onClick={close}
              className="flex min-h-12 shrink-0 items-center justify-center gap-2 border-t border-line px-4 py-3 text-small font-semibold text-primary hover:bg-primary-soft"
            >
              View all notifications <Icon name="arrow" size={16} />
            </Link>
          </section>,
          document.body,
        )}
    </>
  );
}
