import { apiFetch } from "./http.js";
import { API_BASE_URL } from "./config.js";

export const STARTUP_TIMEOUT = 90000;

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

// Retry only this read-only bootstrap request, never orders or other mutations.
export async function fetchSession({
  signal,
  startup = false,
  request = apiFetch,
  now = Date.now,
  wait = pause,
} = {}) {
  const deadline = now() + (startup ? STARTUP_TIMEOUT : 20000);
  let attempt = 0;
  while (true) {
    signal?.throwIfAborted();
    try {
      const response = await request(`${API_BASE_URL}/auth/session`, {
        signal,
        timeout: Math.min(30000, Math.max(1, deadline - now())),
      });
      if (![408, 502, 503, 504].includes(response.status)) return response;
      if (!startup) return response;
    } catch (error) {
      if (signal?.aborted || !startup) throw error;
      if (
        error.status &&
        !(error.status === 200 && error.code === "INVALID_JSON") &&
        ![408, 502, 503, 504].includes(error.status)
      )
        throw error;
    }
    const remaining = deadline - now();
    if (remaining <= 0)
      throw new Error(
        "The store is taking longer than expected to start. Please try again.",
      );
    await wait(
      Math.min(2000 * 2 ** Math.min(attempt++, 3), 10000, remaining),
      signal,
    );
    if (now() >= deadline)
      throw new Error(
        "The store is taking longer than expected to start. Please try again.",
      );
  }
}
