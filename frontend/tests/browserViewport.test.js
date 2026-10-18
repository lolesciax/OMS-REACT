import test from "node:test";
import assert from "node:assert/strict";
import { observeViewport } from "../src/services/browserViewport.js";

function environment(visual = true) {
  const win = new EventTarget(),
    values = new Map(),
    frames = new Map();
  let sequence = 0;
  win.innerHeight = 900;
  win.requestAnimationFrame = (callback) => {
    frames.set(++sequence, callback);
    return sequence;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  if (visual)
    Object.assign(win, {
      visualViewport: Object.assign(new EventTarget(), {
        height: 800,
        offsetTop: 0,
        scale: 1,
      }),
    });
  const style = {
    setProperty: (key, value) => values.set(key, value),
    removeProperty: (key) => values.delete(key),
  };
  const flush = () => {
    for (const callback of frames.values()) callback();
    frames.clear();
  };
  return { win, values, frames, style, flush };
}

test("keyboard resize and pan update modal bounds once per frame", () => {
  const env = environment();
  const stop = observeViewport(env.win, env.style);
  env.flush();
  assert.equal(env.values.get("--app-viewport-height"), "800px");
  Object.assign(env.win.visualViewport, { height: 340, offsetTop: 60 });
  env.win.visualViewport.dispatchEvent(new Event("resize"));
  env.win.visualViewport.dispatchEvent(new Event("scroll"));
  assert.equal(env.frames.size, 1);
  env.flush();
  assert.equal(env.values.get("--app-viewport-height"), "340px");
  assert.equal(env.values.get("--app-viewport-top"), "60px");
  stop();
  env.win.dispatchEvent(new Event("resize"));
  env.win.visualViewport.dispatchEvent(new Event("resize"));
  assert.equal(env.frames.size, 0);
  assert.equal(env.values.size, 0);
});

test("pinch zoom does not resize modal bounds; fallback works without VisualViewport", () => {
  const env = environment();
  const stop = observeViewport(env.win, env.style);
  env.flush();
  Object.assign(env.win.visualViewport, { height: 200, scale: 2 });
  env.win.visualViewport.dispatchEvent(new Event("resize"));
  env.flush();
  assert.equal(env.values.get("--app-viewport-height"), "800px");
  stop();
  const fallback = environment(false);
  const finish = observeViewport(fallback.win, fallback.style);
  fallback.flush();
  assert.equal(fallback.values.get("--app-viewport-height"), "900px");
  finish();
});
