import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../services/http";
import { API_BASE_URL } from "../services/config";
import { toast } from "../services/feedback";

export default function useFavorites(ownerId) {
  const [state, setState] = useState({
    owner: null,
    ids: [],
    ready: false,
    error: "",
  });
  const [pending, setPending] = useState(new Set());
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const requests = useRef(new Map());
  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    setState({ owner: ownerId, ids: [], ready: false, error: "" });
    setPending(new Set());
    if (ownerId) {
      (async () => {
        try {
          const response = await apiFetch(`${API_BASE_URL}/favorites`, {
            signal: controller.signal,
          });
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.productIds))
            throw Error(data.error || "Your liked items could not be loaded.");
          if (generation.current === version)
            setState({
              owner: ownerId,
              ids: data.productIds,
              ready: true,
              error: "",
            });
        } catch (error) {
          if (!controller.signal.aborted && generation.current === version)
            setState({
              owner: ownerId,
              ids: [],
              ready: false,
              error: error.message,
            });
        }
      })();
    }
    const activeRequests = requests.current;
    return () => {
      controller.abort();
      activeRequests.forEach((request) => request.abort());
      activeRequests.clear();
    };
  }, [ownerId, retry]);
  const ids = useMemo(
    () => new Set(state.owner === ownerId ? state.ids : []),
    [state, ownerId],
  );
  const loading =
    !!ownerId && (state.owner !== ownerId || (!state.ready && !state.error));
  const toggle = async (id) => {
    if (
      !ownerId ||
      !state.ready ||
      state.owner !== ownerId ||
      requests.current.has(id)
    )
      return;
    const version = generation.current;
    const controller = new AbortController();
    requests.current.set(id, controller);
    setPending(new Set(requests.current.keys()));
    const liked = ids.has(id);
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/favorites/${encodeURIComponent(id)}`,
        {
          method: liked ? "DELETE" : "PUT",
          signal: controller.signal,
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success)
        throw Error(
          data.error || "Your like could not be saved. Please try again.",
        );
      if (controller.signal.aborted || generation.current !== version) return;
      setState((previous) => ({
        ...previous,
        ids: data.liked
          ? [...new Set([...previous.ids, id])]
          : previous.ids.filter((value) => value !== id),
        error: "",
      }));
      toast.success(
        data.liked
          ? "Added to your liked items."
          : "Removed from your liked items.",
      );
    } catch (error) {
      if (!controller.signal.aborted && generation.current === version)
        setState((previous) => ({ ...previous, error: error.message }));
    } finally {
      if (!controller.signal.aborted && generation.current === version) {
        requests.current.delete(id);
        setPending(new Set(requests.current.keys()));
      }
    }
  };
  return {
    ids,
    pending,
    loading,
    error: state.owner === ownerId ? state.error : "",
    ready: !ownerId || (state.owner === ownerId && state.ready),
    toggle,
    reload: () => setRetry((value) => value + 1),
  };
}
