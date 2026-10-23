import test from "node:test";
import assert from "node:assert/strict";
import {
  notificationDestination,
  notificationTime,
} from "../src/utils/notifications.js";

test("notification destinations are internal and respect current admin access", () => {
  const id = "1234567890abcdef12345678";
  assert.equal(
    notificationDestination(`/order-history?order=${id}`, false),
    `/order-history?order=${id}`,
  );
  assert.equal(
    notificationDestination(`/admin/view-orders/${id}`, true),
    `/admin/view-orders/${id}`,
  );
  for (const value of [
    "//evil.invalid",
    "https://evil.invalid",
    "/\\evil.invalid",
    "/admin/settings",
    "/profile?redirect=evil",
    null,
  ])
    assert.equal(notificationDestination(value, false), "/notifications");
  assert.equal(notificationDestination("/profile", false), "/profile");
  assert.equal(
    notificationDestination("/admin/settings", true),
    "/admin/maintenance",
  );
  assert.equal(
    notificationDestination("https://evil.invalid", true),
    "/admin/notifications",
  );
  assert.equal(
    notificationDestination("/admin/maintenance/security", true),
    "/admin/maintenance/security",
  );
});

test("notification times have readable recent labels and tolerate invalid clocks", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  assert.equal(notificationTime("invalid", now), "Date unavailable");
  assert.equal(notificationTime("2026-10-17T12:00:02Z", now), "Just now");
  assert.equal(notificationTime("2026-10-17T11:58:00Z", now), "2 minutes ago");
  assert.equal(notificationTime("2026-10-16T12:00:00Z", now), "yesterday");
});
