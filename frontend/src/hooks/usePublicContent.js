import { useEffect, useState } from "react";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";

export default function usePublicContent(path, listenForUpdates = true) {
  const [state, setState] = useState({
    path,
    data: null,
    error: "",
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const updated = (event) => {
      if (listenForUpdates && path === `/content/${event.detail}`)
        setAttempt((value) => value + 1);
    };
    window.addEventListener("store:content-updated", updated);
    return () => window.removeEventListener("store:content-updated", updated);
  }, [path, listenForUpdates]);
  useEffect(() => {
    const controller = new AbortController();
    // Keep the same document visible during refresh, but never show a different
    // policy's text while its replacement is loading.
    setState((previous) => ({
      path,
      data: previous.path === path ? previous.data : null,
      error: "",
      loading: true,
    }));
    apiFetch(`${API_BASE_URL}${path}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "This information could not be loaded.",
          );
        if (!controller.signal.aborted)
          setState({ path, data: result, error: "", loading: false });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            error: failure.message,
            loading: false,
          }));
      });
    return () => controller.abort();
  }, [path, attempt]);
  return {
    data: state.path === path ? state.data : null,
    error: state.path === path ? state.error : "",
    loading: state.path !== path || state.loading,
    reload: () => setAttempt((value) => value + 1),
  };
}
