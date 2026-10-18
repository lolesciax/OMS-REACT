import test from "node:test";
import assert from "node:assert/strict";
import { inspectImageFile } from "../src/utils/imageUpload.js";

function decoder(width, height, fails = false) {
  let released = 0,
    cleared = 0,
    timeout;
  return {
    env: {
      URL: {
        createObjectURL: () => "blob:test-image",
        revokeObjectURL: () => released++,
      },
      Image: class {
        naturalWidth = width;
        naturalHeight = height;
        set src(value) {
          assert.equal(value, "blob:test-image");
          queueMicrotask(() => (fails ? this.onerror?.() : this.onload?.()));
        }
      },
      setTimeout: (fn) => {
        timeout = fn;
        return 1;
      },
      clearTimeout: () => cleared++,
    },
    released: () => released,
    cleared: () => cleared,
    timeout: () => timeout(),
  };
}

test("image selection decodes valid images and releases the temporary URL", async () => {
  const d = decoder(1200, 1800);
  assert.equal(await inspectImageFile({}, 20_000_000, d.env), "");
  assert.equal(d.released(), 1);
  assert.equal(d.cleared(), 1);
});

test("image selection rejects oversized, corrupt and zero-dimension images", async () => {
  for (const [width, height, fails, message] of [
    [6000, 4000, false, /20 megapixels/],
    [100, 100, true, /valid JPG/],
    [0, 100, false, /could not be opened/],
  ]) {
    const d = decoder(width, height, fails);
    assert.match(await inspectImageFile({}, 20_000_000, d.env), message);
    assert.equal(d.released(), 1);
  }
});

test("stalled image decoding times out and removes pending callbacks", async () => {
  const d = decoder(1200, 1800);
  const pending = inspectImageFile({}, 20_000_000, d.env);
  d.timeout();
  assert.match(await pending, /too long/);
  assert.equal(d.released(), 1);
});
