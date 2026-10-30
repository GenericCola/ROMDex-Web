import assert from "node:assert/strict";
import test from "node:test";
import { isRasterAttachment, previewBlob } from "../../src/attachments/preview";
import { setAuthSession } from "../../src/auth/session";
import { deliveryConnected } from "../../src/cloud/session";
import {
  attachmentReader,
  attachmentsReadable,
} from "../../src/youtrack/attachment-reader";
void test("attachment previews permit raster types only, never HTML or SVG execution surfaces", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  assert.equal(isRasterAttachment("image/png"), true);
  assert.equal(isRasterAttachment("image/svg+xml"), false);
  assert.throws(() => {
    previewBlob(bytes, "text/html");
  }, /Download/);
  assert.throws(() => {
    previewBlob(bytes, "image/svg+xml");
  }, /Download/);
  const blob = previewBlob(bytes, "image/png");
  assert.equal(blob.type, "image/png");
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});
void test("signed-in attachment reads do not require or enable task mutation delivery", async (t) => {
  assert.equal(deliveryConnected(), false);
  setAuthSession({
    token: "fixture-only",
    userId: "fixture",
    projectId: "0-1",
    expiresAt: Date.now() + 60000,
  });
  t.after(() => {
    setAuthSession(null);
  });
  let reads = 0;
  t.mock.method(globalThis, "fetch", (input: unknown, init?: RequestInit) => {
    assert.equal(typeof input, "string");
    assert.match(String(input), /\/issues\/PMON-900001\/attachments\?/);
    assert.equal(init?.method, "GET");
    reads++;
    return Promise.resolve(Response.json([]));
  });
  assert.equal(attachmentsReadable(), true);
  assert.deepEqual(await attachmentReader().list("PMON-900001"), []);
  assert.equal(reads, 1);
  assert.equal(deliveryConnected(), false);
});
