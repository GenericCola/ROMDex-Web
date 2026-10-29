import assert from "node:assert/strict";
import test from "node:test";
import {
  beginOAuth,
  callbackCode,
  codeChallenge,
  exchangeCode,
  OAUTH_CALLBACK,
} from "../../src/auth/oauth";
test("OAuth uses S256, random transaction state and online public-client grant", async () => {
  assert.equal(
    await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
  const a = await beginOAuth("client", 1);
  const b = await beginOAuth("client", 1);
  assert.notEqual(a.transaction.state, b.transaction.state);
  const url = new URL(a.url);
  assert.equal(url.searchParams.get("access_type"), "online");
  assert.equal(url.searchParams.get("request_credentials"), "default");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("redirect_uri"), OAUTH_CALLBACK);
});
test("callback rejects wrong origin, state, expiry, duplicate code and denial", async () => {
  const { transaction } = await beginOAuth("client", 1);
  const good = OAUTH_CALLBACK + "?state=" + transaction.state + "&code=example";
  assert.equal(callbackCode(good, transaction, 2), "example");
  for (const bad of [
    good.replace("romdex.vercel.app", "example.com"),
    good.replace("romdex.vercel.app", "romdex-web.vercel.app"),
    good + "&code=duplicate",
    good.replace(transaction.state, "wrong"),
    good + "&error=denied",
    good + "#fragment",
  ])
    assert.throws(() => callbackCode(bad, transaction, 2));
  assert.throws(() => callbackCode(good, transaction, transaction.expiresAt));
});
test("token exchange has no secret, cookies or offline grant and validates response", async () => {
  const { transaction } = await beginOAuth("client", 1);
  const fixture: typeof fetch = async (_url, options) => {
    assert.equal(options?.credentials, "omit");
    assert.equal(options?.redirect, "error");
    const body = options?.body as URLSearchParams;
    assert.equal(body.get("code_verifier"), transaction.verifier);
    assert.equal(body.has("client_secret"), false);
    assert.equal(body.has("refresh_token"), false);
    return Response.json({
      access_token: "fixture-only",
      token_type: "Bearer",
      expires_in: 3600,
    });
  };
  assert.equal(
    (await exchangeCode(transaction, "example", fixture, 2)).token,
    "fixture-only",
  );
  await assert.rejects(
    exchangeCode(
      transaction,
      "example",
      async () => Response.json({ access_token: "x" }),
      2,
    ),
  );
});
