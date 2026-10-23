import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";

const NotificationContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const identity = user ? `${user._id}:${user.isAdmin}` : "";
  const [summary, setSummary] = useState({
    identity: "",
    count: 0,
    items: [],
    loading: true,
    error: "",
  });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!identity) return;
    const controller = new AbortController();
    let running = false;
    let scheduled;
    const load = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/notifications?limit=8`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Notifications could not be refreshed.",
          );
        if (!controller.signal.aborted)
          setSummary({
            identity,
            count: data.unreadCount,
            items: data.notifications,
            loading: false,
            error: "",
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setSummary((previous) => ({
            identity,
            count: previous.identity === identity ? previous.count : 0,
            items: previous.identity === identity ? previous.items : [],
            loading: false,
            error: error.message,
          }));
      } finally {
        running = false;
      }
    };
    const schedule = () => {
      clearTimeout(scheduled);
      scheduled = setTimeout(load, 250);
    };
    load();
    const timer = setInterval(load, 30000);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("notifications:refresh", schedule);
    return () => {
      controller.abort();
      clearTimeout(scheduled);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("notifications:refresh", schedule);
    };
  }, [identity, revision]);
  const current =
    summary.identity === identity
      ? summary
      : { count: 0, items: [], loading: !!identity, error: "" };
  return (
    <NotificationContext.Provider
      value={{
        unreadCount: current.count,
        notifications: current.items,
        loading: current.loading,
        error: current.error,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
