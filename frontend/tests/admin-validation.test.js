import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateProduct,
  validateAccount,
  validateDiscount,
  validatePayment,
  validateTracking,
  validateImageFile,
  storeToday,
  rules,
} from "../src/utils/adminValidation.js";
const cases = JSON.parse(
  readFileSync(
    new URL("../../backend/tests/admin_validation_cases.json", import.meta.url),
    "utf8",
  ),
);
const validators = {
  product: validateProduct,
  account: validateAccount,
  discount: validateDiscount,
};
test("admin forms and API agree on the shared validation cases", () => {
  for (const entry of cases)
    assert.deepEqual(
      Object.keys(validators[entry.kind](entry.input)).sort(),
      entry.errors.toSorted(),
      JSON.stringify(entry),
    );
});
test("account edits keep historical usernames and optional password", () => {
  assert.deepEqual(
    validateAccount(
      {
        username: "old.user-name",
        email: "user@example.com",
        password: "",
        phone: "",
        firstName: "",
        lastName: "",
      },
      false,
    ),
    {},
  );
  assert.ok(
    validateAccount({
      username: "valid_user",
      email: "user@example.com",
      password: null,
    }).password,
  );
});
test("payment setup requires merchant identity and a QR before enabling", () => {
  assert.deepEqual(
    Object.keys(
      validatePayment({ merchantName: " ", enabled: true, qrUrl: "" }, null),
    ).sort(),
    ["image", "merchantName"],
  );
  assert.deepEqual(
    validatePayment({ merchantName: "Store", enabled: true, qrUrl: "/qr.png" }),
    {},
  );
});
test("tracking rejects truncated, numeric and non-ASCII values", () => {
  assert.equal(validateTracking(" 123456789012 "), "");
  for (const value of [
    123456789012,
    "12345678901",
    "1234567890123",
    "12345678901x",
    "１２３４５６７８９０１２",
    null,
  ])
    assert.ok(validateTracking(value));
});
test("file validation rejects empty, oversized and mismatched images", () => {
  for (const file of [
    { name: "file.png", type: "image/png", size: 0 },
    { name: "file.png", type: "image/png", size: rules.image.maxBytes + 1 },
    { name: "file.jpg", type: "image/png", size: 10 },
    { name: "file.svg", type: "image/svg+xml", size: 10 },
  ])
    assert.ok(validateImageFile(file));
  assert.equal(
    validateImageFile({ name: "file.png", type: "image/png", size: 100 }),
    "",
  );
});
test("discount dates follow the store timezone rather than browser timezone", () => {
  assert.equal(storeToday(new Date("2026-10-17T18:30:00Z")), "2026-10-18");
});
