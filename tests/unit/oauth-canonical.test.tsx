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
void test("migration callback is exact, retained in exchange, and does not accept arbitrary origins", async () => {
  const { beginOAuth, callbackCode, exchangeCode } =
    await import("../../src/auth/oauth");
  const old = "https://romdex-web.vercel.app/oauth/callback/";
  const { transaction, url } = await beginOAuth("romdex-web", 1, old);
  assert.equal(new URL(url).searchParams.get("redirect_uri"), old);
  assert.equal(
    callbackCode(
      old + "?state=" + transaction.state + "&code=test",
      transaction,
      2,
    ),
    "test",
  );
  assert.throws(() =>
    callbackCode(
      OAUTH_CALLBACK + "?state=" + transaction.state + "&code=test",
      transaction,
      2,
    ),
  );
  await exchangeCode(
    transaction,
    "test",
    async (_url, options) => {
      assert.equal((options?.body as URLSearchParams).get("redirect_uri"), old);
      return Response.json({
        access_token: "fixture",
        token_type: "bearer",
        expires_in: 60,
      });
    },
    2,
  );
  await assert.rejects(
    beginOAuth("romdex-web", 1, "https://evil.test/oauth/callback/"),
  );
});
