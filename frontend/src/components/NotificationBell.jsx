import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import Icon from "./Icon";

export default function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount, loading, error } = useNotifications();
  if (!user) return null;
  return (
    <Link
      to={user.isAdmin ? "/admin/notifications" : "/notifications"}
      className="notification-bell relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-primary shadow-sm hover:bg-primary-soft hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      aria-label={
        error
          ? "Notifications, refresh unavailable"
          : loading
            ? "Notifications, checking unread count"
            : `Notifications, ${unreadCount} unread`
      }
      title={
        error
          ? "Notifications could not be refreshed. Open your inbox to retry."
          : "Open notifications"
      }
    >
      <Icon name="bell" size={21} />
      {loading ? (
        <span className="skeleton absolute -right-1 -top-1 size-4 rounded-full" />
      ) : error ? (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#fff1ec] text-[#8d3326] text-small font-bold">
          !
        </span>
      ) : (
        unreadCount > 0 && (
          <span
            className="absolute -right-2 -top-2 flex min-w-5 h-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white ring-2 ring-paper"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )
      )}
    </Link>
  );
}
