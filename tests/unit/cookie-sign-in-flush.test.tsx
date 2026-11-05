import assert from "node:assert/strict";
import test from "node:test";
import { cookieSignIn } from "../../src/components/romdex/cookie-sign-in";
import { registerDraftEditor } from "../../src/domain/editor-drafts";

test("requesting a remembered sign-in waits for local drafts; save failure preserves identity and sends nothing", async () => {
  const fetch = globalThis.fetch;
  let release = () => {},
    cleared = false,
    requests = 0,
    message = "";
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const unregister = registerDraftEditor({
    dirty: () => true,
    flush: async () => {
      await pending;
      throw Error("Synthetic draft save failed");
    },
  });
  try {
    globalThis.fetch = async () => {
      requests++;
      return new Response();
    };
    const signingIn = cookieSignIn(
      () => true,
      () => {
        cleared = true;
      },
      () => {},
      (value) => {
        message = value;
      },
      true,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(cleared, false);
    assert.equal(requests, 0);
    release();
    await signingIn;
    assert.equal(cleared, false);
    assert.equal(requests, 0);
    assert.match(message, /draft save failed/);
  } finally {
    release();
    unregister();
    globalThis.fetch = fetch;
  }
});
