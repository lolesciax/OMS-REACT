import test from "node:test";
import assert from "node:assert/strict";
import { createFeedbackStore } from "../src/services/feedback.js";
import {
  workspacePreferences,
  moveWorkspaceItem,
} from "../src/utils/workspaceNavigation.js";

test("feedback survives subscribers changing during navigation and can be dismissed", () => {
  const store = createFeedbackStore();
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++);
  const first = store.add("Saved.");
  unsubscribe();
  store.add("Photo selected; save to upload.", "info");
  assert.equal(updates, 1);
  assert.equal(store.getSnapshot().length, 2);
  const snapshot = store.getSnapshot();
  assert.equal(store.getSnapshot(), snapshot);
  store.dismiss(first);
  assert.equal(snapshot.length, 2);
  assert.equal(store.getSnapshot()[0].tone, "info");
  store.dismiss(first);
  assert.equal(store.getSnapshot().length, 1);
});

test("rapid actions stay bounded without suppressing repeated completed actions", () => {
  const store = createFeedbackStore();
  store.add("");
  store.add(null);
  for (let i = 0; i < 8; i++) store.add("Bag updated.");
  assert.equal(store.getSnapshot().length, 4);
  assert.equal(new Set(store.getSnapshot().map(({ id }) => id)).size, 4);
});

test("navigation recovers stale preferences and pins Maintenance last", () => {
  const value = workspacePreferences({
    sidebarOrder: ["maintenance", "orders", "orders", "retired"],
    sidebarWidth: 900,
  });
  assert.equal(value.sidebarOrder[0], "orders");
  assert.equal(value.sidebarOrder.at(-1), "maintenance");
  assert.equal(value.sidebarOrder.length, 6);
  assert.equal(value.sidebarOrder.includes("out-of-stock"), false);
  assert.equal(value.sidebarWidth, 360);
  const moved = moveWorkspaceItem(value.sidebarOrder, "orders", "customers");
  assert.ok(moved.indexOf("orders") < moved.indexOf("customers"));
  assert.equal(moved.at(-1), "maintenance");
  assert.deepEqual(moveWorkspaceItem(moved, "maintenance", "orders"), moved);
  assert.deepEqual(moveWorkspaceItem(moved, "orders", "maintenance"), moved);
  assert.equal(value.sidebarOrder[0], "orders");
});
