import { useEffect, useState } from "react";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";

export default function usePublicContent(path, listenForUpdates = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
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
    setData(null);
    setError("");
    apiFetch(`${API_BASE_URL}${path}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "This information could not be loaded.",
          );
        if (!controller.signal.aborted) setData(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [path, attempt]);
  return { data, error, reload: () => setAttempt((value) => value + 1) };
}
