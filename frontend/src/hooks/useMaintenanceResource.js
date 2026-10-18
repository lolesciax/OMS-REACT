import { toast } from "../services/feedback";
import { useEffect, useState } from "react";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";

export default function useMaintenanceResource(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    apiFetch(`${API_BASE_URL}${path}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "This module could not be loaded.");
        if (!controller.signal.aborted) {
          setData(result);
          if (revision > 0) toast.success("Configuration status refreshed.");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    data,
    loading,
    error,
    reload: () => setRevision((value) => value + 1),
  };
}
