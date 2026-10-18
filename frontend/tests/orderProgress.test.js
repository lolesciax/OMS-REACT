import test from "node:test";
import assert from "node:assert/strict";
import {
  progressState,
  progressSteps,
  shortOrderReference,
} from "../src/utils/orderProgress.js";
import { validateEmail } from "../src/utils/validation.js";
import { orderStatusLabel } from "../src/utils/orders.js";

test("trackers distinguish unpaid orders, proof review and actual verification", () => {
  assert.equal(progressState({ status: "pending" }).current, 1);
  assert.equal(progressState({ status: "pending_payment" }).current, 1);
  const review = { status: "pending", paymentProof: "/proof.png" };
  assert.equal(progressState(review).current, 2);
  assert.match(progressState(review).title, /reviewed/);
  assert.equal(progressSteps(review)[2].label, "Payment review");
  assert.equal(progressSteps(review)[2].at, undefined);
  assert.equal(progressState({ status: "confirmed" }).current, 3);
  assert.equal(progressState({ status: "processing" }).current, 3);
  assert.equal(progressState({ status: "shipped" }).current, 4);
  assert.equal(progressState({ status: "completed" }).current, 5);
  assert.match(
    progressState({ status: "completed", autoCompletedAt: "2026-10-01" }).title,
    /automatically/,
  );
  assert.equal(progressState({ status: "unexpected" }).current, -1);
  assert.equal(
    orderStatusLabel({ status: "completed", autoCompletedAt: "2026-10-01" }),
    "Completed automatically",
  );
});

test("long order references remain readable without losing their unique suffix", () => {
  assert.equal(
    shortOrderReference({
      _id: "123456789012345678901234",
      orderNumber: "ORD-123",
    }),
    "ORD-123",
  );
  assert.equal(
    shortOrderReference({
      _id: "123456789012345678901234",
      orderNumber: "ORD-" + "1".repeat(40),
    }),
    "#78901234",
  );
});

test("email validation rejects invalid domain labels and accepts common valid addresses", () => {
  for (const value of [
    "a@-example.com",
    "a@example-.com",
    "a@exam_ple.com",
    "a..b@example.com",
    ".a@example.com",
    "a@example.c",
    "a@" + "b".repeat(64) + ".com",
  ])
    assert.notEqual(validateEmail(value), "", value);
  for (const value of [
    "person+orders@example.com",
    "first.last@shop.example.ph",
    "a@xn--bcher-kva.de",
  ])
    assert.equal(validateEmail(value), "", value);
});
