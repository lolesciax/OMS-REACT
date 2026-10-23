import test from "node:test";
import assert from "node:assert/strict";
import { fetchSession, STARTUP_TIMEOUT } from "../src/services/session.js";

test("a ready guest session opens immediately without an artificial delay", async () => {
  const response = Response.json({ authenticated: false, user: null });
  let calls = 0;
  const result = await fetchSession({
    startup: true,
    request: async () => {
      calls++;
      return response;
    },
    wait: () => assert.fail("No wait is needed"),
  });
  assert.equal(result, response);
  assert.equal(calls, 1);
});

test("cold-start retries stay within the 90-second deadline and reach readiness", async () => {
  let time = 0,
    calls = 0;
  const timeouts = [];
  const result = await fetchSession({
    startup: true,
    now: () => time,
    wait: async (ms) => {
      time += ms;
    },
    request: async (url, { timeout }) => {
      assert.equal(url, "/api/auth/session");
      timeouts.push(timeout);
      time += 25000;
      return ++calls < 3
        ? Response.json({}, { status: 503 })
        : Response.json({ authenticated: false, user: null });
    },
  });
  assert.equal(result.status, 200);
  assert.ok(time > 20000 && time < STARTUP_TIMEOUT);
  assert.equal(calls, 3);
  assert.ok(timeouts.every((value) => value > 0 && value <= 30000));
});

test("an unavailable server ends loading with a retryable error at the deadline", async () => {
  let time = 0,
    calls = 0;
  await assert.rejects(
    fetchSession({
      startup: true,
      now: () => time,
      wait: async (ms) => {
        time += ms;
      },
      request: async (_url, { timeout }) => {
        calls++;
        time += timeout;
        throw new TypeError("offline");
      },
    }),
    /taking longer than expected/,
  );
  assert.equal(time, STARTUP_TIMEOUT);
  assert.equal(calls, 3);
});

test("cancellation stops bootstrap retries; background checks do not retry", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    fetchSession({
      startup: true,
      signal: controller.signal,
      request: async () => {
        calls++;
        controller.abort();
        throw controller.signal.reason;
      },
      wait: () => assert.fail("No wait after cancellation"),
    }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
  calls = 0;
  const result = await fetchSession({
    request: async () => {
      calls++;
      return Response.json({}, { status: 503 });
    },
    wait: () => assert.fail("No background retries"),
  });
  assert.equal(result.status, 503);
  assert.equal(calls, 1);
});

test("startup HTML is retryable; permanent route errors are returned immediately", async () => {
  let calls = 0;
  await fetchSession({
    startup: true,
    wait: async () => {},
    request: async () => {
      if (++calls === 1)
        throw Object.assign(new Error("HTML wake-up page"), {
          status: 200,
          code: "INVALID_JSON",
        });
      return Response.json({ authenticated: false, user: null });
    },
  });
  assert.equal(calls, 2);
  const notFound = Response.json({}, { status: 404 });
  assert.equal(
    await fetchSession({
      startup: true,
      request: async () => notFound,
      wait: () => assert.fail("Do not retry a permanent route error"),
    }),
    notFound,
  );
});
