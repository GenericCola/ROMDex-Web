import assert from "node:assert/strict";
import test from "node:test";
import { isOAuthOrigin, OAUTH_CALLBACK } from "../../src/auth/oauth";
import { signInPopup } from "../../src/auth/popup";
void test("canonical OAuth origin is exact and old or preview hosts never open a popup", async () => {
  assert.equal(OAUTH_CALLBACK, "https://romdex.vercel.app/oauth/callback/");
  assert.equal(isOAuthOrigin("https://romdex.vercel.app"), true);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    for (const origin of [
      "https://romdex-web.vercel.app",
      "https://romdex-web-preview.vercel.app",
      "http://romdex.vercel.app",
      "https://romdex.vercel.app.evil.test",
    ]) {
      assert.equal(isOAuthOrigin(origin), false);
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: { origin },
          open: () => {
            assert.fail("Noncanonical origin must not open any popup");
          },
        },
      });
      await assert.rejects(signInPopup(), /Open https:\/\/romdex.vercel.app/);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
