import assert from "node:assert/strict";
import test from "node:test";
import { attachmentBytes } from "../../src/youtrack/attachment-bytes";
// Cookie handle form is exercised in cookie-browser.test.tsx; here only the
// token mode contract (unchanged) and the widened target type are checked.
test("attachmentBytes accepts issue or article targets and keeps token mode", async () => {
  const original = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = async (input) => {
    seen.push(String(input));
    return new Response(new Uint8Array([1, 2]));
  };
  try {
    const read = attachmentBytes("synthetic-token");
    const url = "/api/files/1-2/a.bin";
    assert.deepEqual(
      [...(await read(url, 2, { article: "186-6", id: "1-2" }))],
      [1, 2],
    );
    assert.deepEqual(
      [...(await read(url, 2, { issue: "PMON-1", id: "1-2" }))],
      [1, 2],
    );
    assert.deepEqual([...(await read(url, 2))], [1, 2]);
    assert.equal(seen.length, 3);
  } finally {
    globalThis.fetch = original;
  }
});
