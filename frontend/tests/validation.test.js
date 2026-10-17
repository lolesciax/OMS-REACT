import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from "../src/utils/validation.js";
import { canTransition } from "../src/utils/orders.js";

test("registration accepts valid email providers and strong passphrases", () => {
  assert.equal(validateEmail("customer@outlook.com"), "");
  assert.equal(validatePassword("A long passphrase with symbols! 42"), "");
  assert.notEqual(validateEmail("customer@"), "");
  assert.notEqual(validatePassword("short"), "");
  assert.notEqual(validateConfirmPassword("password1", "password2"), "");
});

test("fulfillment controls require proof and prevent skipped or reversed steps", () => {
  assert.equal(canTransition({ status: "pending" }, "confirmed"), false);
  assert.equal(
    canTransition(
      { status: "pending", paymentProof: "/proof.png" },
      "confirmed",
    ),
    true,
  );
  assert.equal(
    canTransition({ status: "pending", paymentProof: "/proof.png" }, "shipped"),
    false,
  );
  assert.equal(canTransition({ status: "processing" }, "shipped"), true);
  assert.equal(canTransition({ status: "completed" }, "pending"), false);
});
