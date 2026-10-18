import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { apiFetch, setCSRFToken } from "../src/services/http.js";
import { imageURL } from "../src/utils/images.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
let expired;
beforeEach(() => {
  setCSRFToken();
  globalThis.window = new EventTarget();
  window.location = { origin: "http://localhost:5180" };
  expired = 0;
  window.addEventListener("auth:expired", () => expired++);
});
after(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

test("successful business mutations refresh notifications without a notification mutation loop", async () => {
  let refreshed = 0;
  window.addEventListener("notifications:refresh", () => refreshed++);
  globalThis.fetch = async () => Response.json({ success: true });
  await apiFetch("/api/orders", { method: "POST" });
  assert.equal(refreshed, 1);
  await apiFetch("/api/notifications/read-all", { method: "POST" });
  await apiFetch("/api/products");
  assert.equal(refreshed, 1);
  globalThis.fetch = async () =>
    Response.json({ error: "Invalid" }, { status: 400 });
  await apiFetch("/api/orders", { method: "POST" });
  assert.equal(refreshed, 1);
});
test("public login failures do not attach a token or expire a session", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.has("Authorization"), false);
    assert.equal(options.credentials, "include");
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  };
  const response = await apiFetch("/api/auth/login");
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Invalid credentials");
  assert.equal(expired, 0);
});
test("protected 401 expires only the session used by the request", async () => {
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.has("Authorization"), false);
    assert.equal(options.credentials, "include");
    return Response.json({ error: "Expired" }, { status: 401 });
  };
  await apiFetch("/api/cart/customer");
  assert.equal(expired, 1);
  globalThis.fetch = async () => {
    setCSRFToken("new-session-csrf");
    return Response.json({ error: "Expired" }, { status: 401 });
  };
  await apiFetch("/api/cart/customer");
  assert.equal(expired, 1);
});
test("HTML proxy errors and offline requests produce readable errors", async () => {
  globalThis.fetch = async () =>
    new Response("<html>Proxy error</html>", { status: 502 });
  await assert.rejects(apiFetch("/api/products"), /server is unavailable/i);
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(apiFetch("/api/products"), /unable to connect/i);
});
test("timeouts are distinct from cancelled navigation requests", async () => {
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason));
    });
  await assert.rejects(
    apiFetch("/api/products", { timeout: 5 }),
    /took too long/i,
  );
  const controller = new AbortController();
  const request = apiFetch("/api/products", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
});
test("historical upload URLs use the active backend and missing images fall back", () => {
  for (const source of [
    "/static/uploads/p6.jpg",
    "http://localhost:5000/static/uploads/p6.jpg",
    "/uploads/p6.jpg",
  ])
    assert.equal(imageURL(source), "/p6.jpg");
  for (const source of [
    "https://old-host.example/static/uploads/shirt.jpg",
    "/uploads/shirt.jpg",
    "shirt.jpg",
    "static\\uploads\\shirt.jpg",
  ])
    assert.equal(imageURL(source), "/static/uploads/shirt.jpg");
  assert.equal(imageURL("/p1.jpg"), "/p1.jpg");
  assert.equal(
    imageURL("/static/uploads/default-product.jpg"),
    "/product-placeholder.svg",
  );
  assert.equal(imageURL(null, "/default-avatar.svg"), "/default-avatar.svg");
  assert.equal(imageURL("javascript:alert(1)"), "/product-placeholder.svg");
});

test("mutations use the CSRF token restored from the database session", async () => {
  globalThis.fetch = async () =>
    Response.json({ user: { _id: "user" }, csrfToken: "restored-csrf" });
  await apiFetch("/api/auth/session");
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("X-CSRF-Token"), "restored-csrf");
    return Response.json({ success: true });
  };
  await apiFetch("/api/checkout", { method: "PUT" });
});

test("a late session refresh cannot replace a newer sign-in CSRF token", async () => {
  let complete;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  const old = apiFetch("/api/auth/session");
  setCSRFToken("new-sign-in");
  complete(
    Response.json({ user: { _id: "old-user" }, csrfToken: "old-session" }),
  );
  await old;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.get("X-CSRF-Token"), "new-sign-in");
    return Response.json({ success: true });
  };
  await apiFetch("/api/checkout", { method: "PATCH" });
});
