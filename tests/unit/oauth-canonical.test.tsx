import assert from "node:assert/strict";
import test from "node:test";
import { OAUTH_CALLBACK } from "../../src/auth/oauth";
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
