import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { connect, delay } from "./browser-support.mjs";
const meta = JSON.parse(
  await readFile(
    new URL("../../.tmp/browser-fixture.json", import.meta.url),
    "utf8",
  ),
);
assert.match(meta.database, /^oms_test_[a-f0-9]{24}$/);
assert.ok(
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.OMS_BROWSER_BASE_URL || "http://127.0.0.1:5181")
      .hostname,
  ),
);
const b = await connect();
let injected;
try {
  await b.send("Network.clearBrowserCookies");
  await b.viewport(390, 844);
  injected = await b.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    const originalFetch = window.fetch;
    window.__sentSession = 0;
    window.fetch = async (input, options) => {
      if (new URL(input,location.origin).pathname==='/api/auth/session') {
        await new Promise((resolve,reject)=>{
          const abort=()=>{clearTimeout(timer);reject(options.signal.reason)};
          const timer=setTimeout(()=>{options.signal?.removeEventListener('abort',abort);resolve()},25000);
          if(options.signal?.aborted)abort();else options.signal?.addEventListener('abort',abort,{once:true});
        });
        window.__sentSession++;
      }
      return originalFetch(input,options);
    };
  `,
  });
  await b.send("Page.navigate", {
    url: (process.env.OMS_BROWSER_BASE_URL || "http://127.0.0.1:5181") + "/",
  });
  await b.wait(
    "document.body.innerText.includes('Getting the store ready')",
    15000,
  );
  await delay(13000);
  assert.ok(await b.e("!!document.querySelector('.skeleton')"));
  assert.equal(
    await b.e("document.body.innerText.includes('took too long')"),
    false,
  );
  await b.shot("startup-waking-mobile");
  await b.wait("!!document.querySelector('.shop-product')", 15000);
  assert.equal(await b.e("window.__sentSession"), 1);
  await b.e(
    "for(let i=0;i<5;i++)document.dispatchEvent(new Event('visibilitychange'))",
  );
  await delay(200);
  assert.equal(await b.e("window.__sentSession"), 1);
  await b.send("Page.removeScriptToEvaluateOnNewDocument", {
    identifier: injected.identifier,
  });
  injected = null;
  console.log(
    "25-second startup delay: skeleton stays visible, waking message appears, guest opens automatically; no anonymous visibility refresh loop.",
  );
  await b.login("customer_test");
  await b.navigate("/");
  await b.wait(
    "!!document.querySelector('.shop-product .product-like-button:not(:disabled)')",
  );
  const result = await b.e(
    "fetch('/api/auth/session').then(async r=>({status:r.status,body:await r.json()}))",
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.authenticated, true);
  assert.equal(result.body.user.username, "customer_test");
  await b.e(
    "import('/src/services/http.js').then(({apiFetch})=>apiFetch('/api/auth/logout',{method:'POST'}))",
  );
  await b.navigate("/");
  const guest = await b.e(
    "fetch('/api/auth/session').then(async r=>({status:r.status,body:await r.json()}))",
  );
  assert.deepEqual(guest, {
    status: 200,
    body: { authenticated: false, user: null },
  });
  assert.equal(await b.e("fetch('/api/favorites').then(r=>r.status)"), 401);
  assert.equal(b.errors.length, 0, JSON.stringify(b.errors));
  console.log(
    "Signed-in restoration, logout, anonymous 200, and protected 401 passed.",
  );
  // Exercise actual hooks in a separate React root with controlled requests.
  // This checks refresh behavior without changing any store records.
  await b.e(`(async () => {
    const {default: React} = await import('/node_modules/.vite/deps/react.js');
    const {default: ReactDOM} = await import('/node_modules/.vite/deps/react-dom_client.js');
    const {AuthProvider, useAuth} = await import('/src/contexts/AuthContext.jsx');
    const {default: usePublicContent} = await import('/src/hooks/usePublicContent.js');
    const realFetch = window.fetch;
    const host = document.createElement('div');
    host.id = 'loading-probe'; document.body.append(host);
    const root = ReactDOM.createRoot(host);
    window.__loadingProbe = {pending: [], path: '/content/probe'};
    const probe = window.__loadingProbe;
    window.fetch = (input, options) => {
      const path = new URL(input, location.origin).pathname;
      if (path === '/api/auth/session' || path.startsWith('/api/content/probe'))
        return new Promise(resolve => probe.pending.push({path, resolve}));
      return realFetch(input, options);
    };
    function Probe() {
      const auth = useAuth();
      const content = usePublicContent(probe.path, false);
      probe.auth = auth; probe.content = content;
      return React.createElement('input', {id:'probe-input', defaultValue:'unsaved draft'});
    }
    probe.render = () => root.render(React.createElement(AuthProvider, null, React.createElement(Probe)));
    probe.reply = (path, data) => {
      const index = probe.pending.findIndex(item => item.path === path);
      if(index < 0) throw Error('No pending request for '+path);
      probe.pending.splice(index,1)[0].resolve(Response.json(data));
    };
    probe.cleanup = () => {root.unmount();host.remove();window.fetch=realFetch;delete window.__loadingProbe;};
    probe.render();
  })()`);
  try {
    await b.wait("window.__loadingProbe.pending.length === 2");
    await b.e(`__loadingProbe.reply('/api/auth/session', {authenticated:false,user:null});
      __loadingProbe.reply('/api/content/probe', {title:'Original document'});`);
    await b.wait(
      "!__loadingProbe.auth.loading && !__loadingProbe.content.loading",
    );
    await b.e(
      "document.querySelector('#probe-input').value='Keep this draft'; __loadingProbe.auth.checkAuthStatus(); __loadingProbe.content.reload()",
    );
    await b.wait(
      "__loadingProbe.pending.length === 2 && __loadingProbe.content.loading",
    );
    assert.equal(await b.e("__loadingProbe.auth.loading"), false);
    assert.equal(
      await b.e("__loadingProbe.content.data.title"),
      "Original document",
    );
    assert.equal(
      await b.e("document.querySelector('#probe-input').value"),
      "Keep this draft",
    );
    await b.e(`__loadingProbe.reply('/api/auth/session', {authenticated:false,user:null});
      __loadingProbe.reply('/api/content/probe', {title:'Updated document'});`);
    await b.wait("__loadingProbe.content.data?.title === 'Updated document'");
    await b.e(
      "__loadingProbe.path='/content/probe-next'; __loadingProbe.render()",
    );
    await b.wait(
      "__loadingProbe.pending.some(item=>item.path==='/api/content/probe-next')",
    );
    assert.equal(await b.e("__loadingProbe.content.data"), null);
    await b.e(
      "__loadingProbe.path='/content/probe-final'; __loadingProbe.render()",
    );
    await b.wait(
      "__loadingProbe.pending.some(item=>item.path==='/api/content/probe-final')",
    );
    await b.e(`__loadingProbe.reply('/api/content/probe-final', {title:'Current policy'});
      __loadingProbe.reply('/api/content/probe-next', {title:'Stale policy'});`);
    await b.wait("!__loadingProbe.content.loading");
    assert.equal(
      await b.e("__loadingProbe.content.data.title"),
      "Current policy",
    );
    console.log(
      "Background session refresh preserves forms; content refresh preserves the current document; navigation clears old text and ignores stale responses.",
    );
  } finally {
    await b.e("__loadingProbe.cleanup()");
  }
} finally {
  if (injected)
    await b.send("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: injected.identifier,
    });
  b.close();
}
