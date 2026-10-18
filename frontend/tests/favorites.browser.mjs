import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { connect, delay } from "./browser-support.mjs";

const metadata = JSON.parse(
  await readFile(
    new URL("../../.tmp/browser-fixture.json", import.meta.url),
    "utf8",
  ),
);
assert.match(metadata.database, /^oms_test_[a-f0-9]{24}$/);
assert.ok(
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.OMS_BROWSER_BASE_URL || "http://127.0.0.1:5181")
      .hostname,
  ),
);
const b = await connect();
const card = ".shop-product:first-child";
const heart = `${card} .product-like-button`;
const modalHeart = ".shop-dialog .product-like-button";
async function loaded() {
  await b.wait(
    `!!document.querySelector('.shop-product .product-like-button:not(:disabled)')`,
  );
}
async function pressed(selector, value) {
  await b.wait(
    `document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-pressed')===${JSON.stringify(String(value))}`,
  );
}
const layouts = [];
try {
  await b.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await b.send("Network.clearBrowserCookies");
  await b.viewport(1440, 900);
  await b.navigate("/");
  await loaded();
  assert.equal(await b.e("!!document.querySelector('button button')"), false);
  await b.click(heart);
  await b.wait("location.pathname==='/login'");
  await b.login("customer_test");
  await b.navigate("/");
  await loaded();
  // The fixture is disposable, so start with an explicit known state.
  if (
    await b.e(
      `document.querySelector(${JSON.stringify(heart)}).getAttribute('aria-pressed')==='true'`,
    )
  ) {
    await b.click(heart);
    await pressed(heart, false);
  }
  await b.click(heart);
  await pressed(heart, true);
  assert.equal(await b.e("!!document.querySelector('.shop-dialog')"), false);
  await b.navigate("/");
  await loaded();
  await pressed(heart, true);
  await b.click(`${card} .shop-product-open`);
  await b.wait("!!document.querySelector('.shop-dialog')");
  await pressed(modalHeart, true);
  await b.click(modalHeart);
  await pressed(modalHeart, false);
  await pressed(heart, false);
  await b.click(modalHeart);
  await pressed(modalHeart, true);
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [768, 1024],
    [1440, 900],
    [1920, 1080],
    [844, 390],
  ]) {
    await b.viewport(width, height);
    const bounds = await b.e(
      `(()=>{const n=document.querySelector('.shop-dialog');const r=n.getBoundingClientRect();const h=n.querySelector('.product-like-button').getBoundingClientRect();return{width:innerWidth,scroll:document.documentElement.scrollWidth,internal:n.scrollWidth-n.clientWidth,top:r.top,bottom:r.bottom,target:[h.width,h.height]}})()`,
    );
    assert.ok(
      bounds.scroll <= width + 1 && bounds.internal <= 2,
      JSON.stringify(bounds),
    );
    assert.ok(
      bounds.top >= 0 && bounds.bottom <= height + 1,
      JSON.stringify(bounds),
    );
    assert.ok(
      bounds.target.every((n) => n >= 43.5),
      JSON.stringify(bounds),
    );
    layouts.push(bounds);
  }
  await b.viewport(1440, 900);
  await b.shot("likes-product-desktop");
  await b.e(
    `window.__likesAuditFetch=window.fetch;window.fetch=async(input,init)=>String(input).includes('/api/favorites/')&&init?.method==='DELETE'?new Response(JSON.stringify({error:'Test save failed. Please retry.'}),{status:503,headers:{'Content-Type':'application/json'}}):window.__likesAuditFetch(input,init)`,
  );
  await b.click(modalHeart);
  await b.wait(
    "document.querySelector('.shop-dialog')?.textContent.includes('Test save failed')",
  );
  await pressed(modalHeart, true);
  await b.e(
    "window.fetch=window.__likesAuditFetch;delete window.__likesAuditFetch",
  );
  await b.click(".shop-dialog-close");
  await b.click(".shop-liked-filter");
  await b.wait(
    "location.search.includes('liked=true') && document.querySelectorAll('.shop-product').length===1",
  );
  assert.equal(
    await b.e("document.querySelectorAll('.shop-product').length"),
    1,
  );
  await b.navigate("/?liked=true");
  await loaded();
  assert.equal(
    await b.e("document.querySelectorAll('.shop-product').length"),
    1,
  );
  await b.viewport(390, 844);
  await b.e("document.querySelector('.shop-likes-toolbar').scrollIntoView()");
  await delay(100);
  await b.shot("likes-products-mobile");
  await b.login("admin_test");
  await b.navigate("/");
  await loaded();
  await pressed(heart, false);
  await b.login("customer_test");
  await b.navigate("/");
  await loaded();
  await pressed(heart, true);
  await b.e(`document.querySelector(${JSON.stringify(heart)}).focus()`);
  await b.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: " ",
    code: "Space",
  });
  await b.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: " ",
    code: "Space",
  });
  await pressed(heart, false);
  await b.navigate("/");
  await loaded();
  await pressed(heart, false);
  assert.equal(b.errors.length, 0, JSON.stringify(b.errors));
  console.log(
    JSON.stringify({
      layouts: layouts.length,
      checks:
        "guest sign-in, persisted likes, modal/card sync, account isolation, error retention, liked filter, keyboard unlike",
      errors: b.errors,
    }),
  );
} catch (error) {
  await b.shot("likes-browser-failure");
  throw error;
} finally {
  b.close();
}
