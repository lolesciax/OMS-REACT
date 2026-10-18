import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { connect, delay } from "./browser-support.mjs";
const meta = JSON.parse(
  await readFile(
    new URL("../../.tmp/browser-fixture.json", import.meta.url),
    "utf8",
  ),
);
if (!/^oms_test_[a-f0-9]{24}$/.test(meta.database))
  throw Error("Use the disposable browser fixture.");
const baseURL = new URL(
  process.env.OMS_BROWSER_BASE_URL || "http://127.0.0.1:5181",
);
if (!["localhost", "127.0.0.1"].includes(baseURL.hostname))
  throw Error("The responsive audit is restricted to a local test server.");
if (!meta.shippedOrderId)
  throw Error("Start the browser fixture with --responsive.");
const b = await connect();
const results = [];
const failures = [];
const dialogs = [];
const dimensions = [
  [320, 740],
  [375, 812],
  [390, 844],
  [600, 900],
  [768, 1024],
  [900, 1100],
  [1024, 768],
  [1150, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [844, 390],
];
async function audit(path) {
  await b.viewport(390, 844);
  await b.navigate(path);
  await delay(100);
  for (const [width, height] of dimensions) {
    await b.viewport(width, height);
    const data = await b.e(
      `(()=>{const width=innerWidth;const offenders=[...document.querySelectorAll('body *')].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.right>width+1&&!n.closest('.admin-table-scroll')}).slice(0,12).map(n=>({tag:n.tagName,c:String(n.className).slice(0,100),text:n.textContent.slice(0,55),right:Math.round(n.getBoundingClientRect().right)}));return{path:location.pathname,viewport:[innerWidth,innerHeight],clipped:[...document.querySelectorAll('.order-card,.order-tracking,.checkout-summary-items > div,.customer-summary,.admin-pagination')].filter(n=>n.clientWidth&&n.scrollWidth>n.clientWidth+2).map(n=>({c:n.className,width:n.clientWidth,scroll:n.scrollWidth})),scroll:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>width+1,offenders,tiny:[...document.querySelectorAll('main button, main a.ui-button')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.width<40&&r.height<40}).slice(0,8).map(n=>({label:n.getAttribute('aria-label')||n.textContent.trim().slice(0,35),c:n.className}))};})()`,
    );
    results.push(data);
    if (data.overflow || data.clipped.length)
      console.log(
        "OVERFLOW " + path + " " + width + " " + JSON.stringify(data.offenders),
      );
  }
  console.log("AUDITED " + path);
}
async function auditDialog(path, label, closeSelector) {
  await b.viewport(390, 844);
  await b.navigate(path);
  await b.e(
    `[...document.querySelectorAll('button')].find(n=>n.textContent.trim().startsWith(${JSON.stringify(label)})).click()`,
  );
  await b.wait(`!!document.querySelector('[role=dialog]')`);
  for (const [width, height] of [
    [320, 740],
    [375, 812],
    [768, 1024],
    [844, 320],
  ]) {
    await b.viewport(width, height);
    const dialog = await b.e(
      `(()=>{const n=document.querySelector('[role=dialog]');const r=n.getBoundingClientRect();const c=document.querySelector(${JSON.stringify(closeSelector)}).getBoundingClientRect();return{viewport:[innerWidth,innerHeight],width:n.clientWidth,scroll:n.scrollWidth,top:r.top,bottom:r.bottom,close:[c.width,c.height]}})()`,
    );
    assert.ok(
      dialog.scroll <= dialog.width + 1,
      `Dialog content clipped: ${path} at ${width}`,
    );
    assert.ok(
      dialog.top >= 0 && dialog.bottom <= height,
      `Dialog outside viewport: ${path} at ${width}`,
    );
    assert.ok(
      dialog.close.every((size) => size >= 43.5),
      `Dialog close target too small: ${path}: ${JSON.stringify(dialog)}`,
    );
    dialogs.push({ path, ...dialog });
  }
  await b.click(closeSelector);
}
try {
  await b.send("Network.clearBrowserCookies");
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/help",
    "/faqs",
    "/policies",
    "/policies/privacy",
    "/policies/shipping",
    "/policies/returns",
    "/terms",
    "/contact",
  ])
    await audit(path);
  await auditDialog("/login", "Forgot your password?", ".auth-modal-close");
  await b.viewport(1440);
  await b.login("customer_test");
  for (const path of [
    "/cart",
    "/checkout",
    "/profile",
    "/order-history",
    "/notifications",
  ])
    await audit(path);
  await auditDialog(
    "/order-history",
    "Confirm delivery",
    '[aria-label="Close delivery confirmation"]',
  );
  await b.viewport(1440);
  await b.login("admin_test");
  for (const path of [
    "/admin/dashboard",
    "/admin/products",
    "/admin/orders",
    "/admin/customers",
    "/admin/discounts",
    "/admin/notifications",
    `/admin/view-orders/${meta.shippedOrderId}`,
    "/admin/maintenance",
    "/admin/maintenance/payments",
    "/admin/maintenance/roles",
    "/admin/maintenance/profile",
    "/admin/maintenance/policies",
    "/admin/maintenance/faqs",
    "/admin/maintenance/support",
    "/admin/maintenance/security",
  ])
    await audit(path);
  for (const [path, label] of [
    ["/admin/products", "Add a product"],
    ["/admin/customers", "Add an account"],
    ["/admin/discounts", "Create a code"],
    ["/admin/maintenance/roles", "Add role"],
  ])
    await auditDialog(path, label, '[aria-label="Close editor"]');
} catch (error) {
  failures.push(error.stack);
  console.error(error.stack);
} finally {
  await writeFile(
    new URL("../../.tmp/responsive-audit.json", import.meta.url),
    JSON.stringify({ results, dialogs, failures, errors: b.errors }, null, 2),
  );
  if (
    failures.length ||
    b.errors.length ||
    results.some((x) => x.overflow || x.clipped?.length)
  )
    process.exitCode = 1;
  console.log(
    JSON.stringify({
      samples: results.length,
      dialogSamples: dialogs.length,
      overflow: results
        .filter((x) => x.overflow)
        .map(({ path, viewport }) => ({ path, viewport })),
      failures,
      errors: b.errors,
    }),
  );
  b.close();
}
