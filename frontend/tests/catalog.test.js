import test from "node:test";
import assert from "node:assert/strict";
import { filterProducts, formatPrice } from "../src/utils/catalog.js";
import { validateAddress } from "../src/utils/address.js";
import { postLoginPath } from "../src/utils/navigation.js";

const collection = [
  {
    id: "sold",
    name: "Soft shirt",
    category: "Tops",
    price: 50,
    stock: 0,
    size: "M",
  },
  {
    id: "jacket",
    name: "Denim jacket",
    description: "Relaxed cotton",
    category: "Outerwear",
    price: 300,
    stock: 2,
    size: "L",
  },
  {
    id: "tee",
    name: "Cotton tee",
    category: "Tops",
    price: 100,
    stock: 1,
    size: "M",
  },
];

test("catalog search covers names, descriptions, categories, and sizes", () => {
  assert.deepEqual(
    filterProducts(collection, { search: "  denim  " }).map((item) => item.id),
    ["jacket"],
  );
  assert.deepEqual(
    filterProducts(collection, { search: "relaxed" }).map((item) => item.id),
    ["jacket"],
  );
  assert.equal(filterProducts(collection, { search: "Outerwear" }).length, 1);
  assert.equal(
    filterProducts(collection, { search: "M", category: "Tops" }).length,
    2,
  );
  assert.equal(filterProducts(collection, { search: "no-match" }).length, 0);
});

test("sorting keeps available pieces first and leaves the source collection unchanged", () => {
  assert.deepEqual(
    filterProducts(collection, { sort: "price-asc" }).map((item) => item.id),
    ["tee", "jacket", "sold"],
  );
  assert.deepEqual(
    filterProducts(collection, { category: "Tops", inStockOnly: true }).map(
      (item) => item.id,
    ),
    ["tee"],
  );
  assert.deepEqual(
    collection.map((item) => item.id),
    ["sold", "jacket", "tee"],
  );
});

test("unknown prices do not display a misleading zero amount", () => {
  assert.equal(formatPrice(undefined), "—");
  assert.equal(formatPrice(Infinity), "—");
  assert.equal(formatPrice("bad-price"), "—");
  assert.match(formatPrice("120"), /120\.00/);
  assert.match(formatPrice(0), /0\.00/);
});

test("delivery validation checks required fields and common Philippine phone formats", () => {
  assert.equal(Object.keys(validateAddress({})).length, 6);
  const complete = {
    recipient: "Alex Rivera",
    contact: "0912 345 6789",
    street: "22 Main Street",
    barangay: "Central",
    city: "Cebu City",
    province: "Cebu",
  };
  assert.deepEqual(validateAddress(complete), {});
  assert.deepEqual(
    validateAddress({ ...complete, contact: "+63 912 345 6789" }),
    {},
  );
  assert.ok(validateAddress({ ...complete, contact: "123" }).contact);
  assert.ok(validateAddress({ ...complete, street: "   " }).street);
});

test("sign-in returns to the requested page without redirect loops or external destinations", () => {
  assert.equal(
    postLoginPath({ isAdmin: false }, "/order-history"),
    "/order-history",
  );
  assert.equal(
    postLoginPath({ isAdmin: true }, "/admin/orders"),
    "/admin/orders",
  );
  assert.equal(postLoginPath({ isAdmin: false }, "/admin/orders"), "/");
  assert.equal(postLoginPath({ isAdmin: false }, "//outside.example"), "/");
  assert.equal(postLoginPath({ isAdmin: false }, "/\\outside.example"), "/");
  assert.equal(
    postLoginPath({ isAdmin: true }, "/login?again=1"),
    "/admin/dashboard",
  );
});
