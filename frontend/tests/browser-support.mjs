import { writeFile } from "node:fs/promises";
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function connect() {
  const tabs = await (
    await fetch(
      process.env.OMS_CHROME_DEBUG_URL || "http://127.0.0.1:9223/json",
    )
  ).json();
  const ws = new WebSocket(
    tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let next = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", (event) => {
    const d = JSON.parse(event.data);
    if (d.method === "Runtime.exceptionThrown")
      errors.push(d.params.exceptionDetails.text);
    if (d.id) {
      const p = pending.get(d.id);
      if (!p) return;
      pending.delete(d.id);
      clearTimeout(p.timer);
      d.error ? p.reject(Error(JSON.stringify(d.error))) : p.resolve(d.result);
    }
  });
  ws.addEventListener("close", () => {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("The audit browser disconnected."));
    }
    pending.clear();
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error(`Browser command timed out: ${method}`));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const e = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const wait = async (expression, timeout = 20000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      if (await e(expression)) return;
      await delay(100);
    }
    throw Error(
      "Timeout: " +
        expression +
        "\n" +
        (await e("document.body.innerText.slice(0,1500)")),
    );
  };
  const q = (s) => `document.querySelector(${JSON.stringify(s)})`;
  const click = (s) => e(`${q(s)}.click()`);
  const viewport = async (width, height = 900) => {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 900,
    });
    await send("Emulation.setTouchEmulationEnabled", {
      enabled: width <= 900,
      maxTouchPoints: 1,
    });
    await delay(80);
  };
  const shot = async (name) => {
    const s = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(
      new URL("../../.tmp/" + name + ".png", import.meta.url),
      Buffer.from(s.data, "base64"),
    );
  };
  const navigate = async (path) => {
    await send("Page.navigate", {
      url: (process.env.OMS_BROWSER_BASE_URL || "http://127.0.0.1:5181") + path,
    });
    await wait(
      `location.pathname===${JSON.stringify(new URL(path, "http://localhost").pathname)} && !!document.querySelector('h1')`,
    );
    await wait(`!document.querySelector('main .skeleton')`);
    if (
      await e(
        `document.querySelector('h1')?.textContent.includes('This page needs a refresh')`,
      )
    )
      throw Error(`The page failed to render: ${path}`);
  };
  const login = async (username) => {
    await send("Network.clearBrowserCookies");
    await navigate("/login");
    await wait(`!!${q("altcha-widget")}`);
    for (const [selector, value] of [
      ["#login-username", username],
      ["#login-password", "Demo-123!"],
    ])
      await e(
        `(()=>{const n=${q(selector)};Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(n,${JSON.stringify(value)});n.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
    await e(`${q("altcha-widget")}.verify()`);
    await wait(
      `${q("altcha-widget")}.textContent.includes('Verified') || ${q("altcha-widget")}.shadowRoot?.textContent.includes('Verified')`,
    );
    await click("form:has(#login-username) button[type=submit]");
    await wait(`!location.pathname.startsWith('/login')`);
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  return {
    send,
    e,
    wait,
    q,
    click,
    viewport,
    shot,
    navigate,
    login,
    errors,
    close: () => ws.close(),
  };
}
