import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { connect } from "./browser-support.mjs";

const meta = JSON.parse(
  await readFile(
    new URL("../../.tmp/browser-fixture.json", import.meta.url),
    "utf8",
  ),
);
const base = new URL(
  process.env.OMS_BROWSER_BASE_URL || "http://127.0.0.1:5181",
);
if (
  !/^oms_test_[a-f0-9]{24}$/.test(meta.database) ||
  !["localhost", "127.0.0.1"].includes(base.hostname)
)
  throw Error("Use the disposable local browser fixture.");
const b = await connect();
const select = (selector, value) =>
  b.e(
    `(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
try {
  await b.send("Network.clearBrowserCookies");
  await b.viewport(1440, 1000);
  await b.navigate("/");
  await b.wait('document.querySelectorAll(".shop-product").length===2');
  assert.equal(
    await b.e('document.querySelectorAll("#collection-category").length'),
    1,
  );
  await select("#collection-category", "Jackets");
  await b.wait('document.querySelectorAll(".shop-product").length===1');
  assert.ok(
    await b.e(
      'document.querySelector(".shop-product").textContent.includes("Everyday jacket")',
    ),
  );
  await b.click(".shop-result-line button");
  await b.wait('document.querySelectorAll(".shop-product").length===2');
  assert.equal(
    await b.e('document.querySelector("#collection-category").value'),
    "All",
  );
  await select(".shop-sort select", "price-desc");
  assert.ok(
    await b.e(
      'document.querySelector(".shop-product").textContent.includes("Everyday jacket")',
    ),
  );
  await b.e(
    `(()=>{const n=document.querySelector('header input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,'Vintage');n.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await b.wait('document.querySelectorAll(".shop-product").length===1');
  assert.equal(
    await b.e('new URLSearchParams(location.search).get("q")'),
    "Vintage",
  );
  await b.click('header [aria-label="Clear search"]');
  await b.wait('document.querySelectorAll(".shop-product").length===2');
  await b.click(".shop-product-open");
  await b.wait('!!document.querySelector(".shop-dialog")');
  await b.click('[aria-label="Close product details"]');
  await b.click(".shop-liked-filter");
  await b.wait('location.pathname==="/login"');
  await b.navigate("/signup");
  const rows = await b.e(
    `['username','email','password','confirm'].map(n=>document.getElementById('signup-'+n).getBoundingClientRect().top)`,
  );
  assert.ok(
    Math.abs(rows[0] - rows[1]) < 1 && Math.abs(rows[2] - rows[3]) < 1,
    "Desktop signup pairs must align.",
  );
  assert.deepEqual(b.errors, []);
  console.log(
    "Catalog category, reset, sort, navbar search, product dialog, liked sign-in, and signup alignment passed.",
  );
} finally {
  b.close();
}
