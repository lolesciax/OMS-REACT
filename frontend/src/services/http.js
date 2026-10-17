let csrfToken = "";
let sessionVersion = 0;
export function setCSRFToken(value = "") {
  csrfToken = value;
  sessionVersion++;
}

const failureMessage = (status) =>
  ({
    401: "Your session has expired. Please sign in again.",
    403: "You do not have access to this action.",
    404: "This information is no longer available. Refresh and try again.",
    413: "This file is too large. Choose a smaller image.",
    429: "Too many requests. Please wait a moment and try again.",
  })[status] ||
  (status >= 500
    ? "The server is unavailable. Please try again shortly."
    : "The server returned an unexpected response. Please try again.");

export async function apiFetch(input, { timeout = 20000, ...options } = {}) {
  const url = new URL(input, window.location.origin);
  const headers = new Headers(options.headers);
  const version = sessionVersion;
  const publicAuth =
    url.pathname.startsWith("/api/auth/") && !url.pathname.endsWith("/logout");
  if (
    csrfToken &&
    !["GET", "HEAD", "OPTIONS"].includes(
      (options.method || "GET").toUpperCase(),
    )
  )
    headers.set("X-CSRF-Token", csrfToken);
  const controller = new AbortController();
  const cancel = () => controller.abort(options.signal.reason);
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeout,
  );
  try {
    const response = await fetch(input, {
      ...options,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    if (response.status === 401 && !publicAuth && sessionVersion === version)
      window.dispatchEvent(new Event("auth:expired"));
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error(failureMessage(response.status));
    }
    if (!data || typeof data !== "object")
      throw new Error(failureMessage(response.status));
    if (
      data.csrfToken &&
      publicAuth &&
      (url.pathname.endsWith("/login") || sessionVersion === version)
    )
      setCSRFToken(data.csrfToken);
    response.json = async () => data;
    return response;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw new Error("The request took too long. Please try again.");
    if (error instanceof TypeError)
      throw new Error(
        "Unable to connect to the server. Check your connection and try again.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
