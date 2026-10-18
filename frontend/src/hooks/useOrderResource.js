import { toast } from "../services/feedback";
import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "../services/http";

// Keep the last successful response visible while checking for order changes.
export default function useOrderResource(url, paused = false) {
  const [state, setState] = useState({
    url: "",
    data: null,
    refreshing: true,
    error: "",
    updatedAt: null,
  });
  const [revision, setRevision] = useState(0);
  const requestedFeedback = useRef(false);
  const refresh = useCallback((options = {}) => {
    requestedFeedback.current = options.feedback === true;
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (running || controller.signal.aborted) return;
      running = true;
      setState((previous) => ({
        url,
        data: previous.url === url ? previous.data : null,
        updatedAt: previous.url === url ? previous.updatedAt : null,
        refreshing: true,
        error: "",
      }));
      try {
        const response = await apiFetch(url, { signal: controller.signal });
        const data = await response.json();
        if (
          !response.ok ||
          !data.success ||
          !(Array.isArray(data.orders) || data.order)
        )
          throw new Error(
            data.error || "Orders could not be refreshed. Please try again.",
          );
        if (!controller.signal.aborted) {
          if (requestedFeedback.current)
            toast.success("Order status refreshed.");
          requestedFeedback.current = false;
          setState({
            url,
            data,
            refreshing: false,
            error: "",
            updatedAt: new Date(),
          });
        }
      } catch (failure) {
        if (!controller.signal.aborted) requestedFeedback.current = false;
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            refreshing: false,
            error: failure.message,
          }));
      } finally {
        running = false;
      }
    };
    const whenVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    load();
    const timer = setInterval(whenVisible, 30000);
    document.addEventListener("visibilitychange", whenVisible);
    window.addEventListener("focus", whenVisible);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", whenVisible);
      window.removeEventListener("focus", whenVisible);
    };
  }, [url, revision, paused]);
  const current =
    state.url === url
      ? state
      : { data: null, refreshing: true, error: "", updatedAt: null };
  return { ...current, loading: !current.data && current.refreshing, refresh };
}
