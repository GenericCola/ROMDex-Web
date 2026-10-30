import assert from "node:assert/strict";
import test from "node:test";
import { FENCE } from "./cookie-codec.ts";
import { fixture } from "./cookie-fixture.ts";
import { createGeneration, GENERATION_COOKIE } from "./cookie-generation.ts";
test("browser-only generation rotates without token/Node dependencies and rejects cross-tab stale results", () => {
  assert.equal(GENERATION_COOKIE, FENCE);
  let cookie = "";
  let count = 0;
  const controller = createGeneration({
    readCookie: () => cookie,
    writeCookie: (value) => {
      assert.ok(!value.includes("HttpOnly"));
      assert.ok(value.includes("Secure; SameSite=Lax"));
      cookie = value.split(";")[0]!;
    },
    random: () => String(++count).padStart(43, "x"),
  });
  const first = controller.rotate();
  controller.assertCurrent(first);
  controller.rotate();
  assert.throws(() => controller.assertCurrent(first));
});
test("delayed begin response cannot reset logout generation or authorize its stale flow", async () => {
  const f = fixture();
  await f.login();
  f.jar.set(FENCE, f.deps.entropy());
  const pending = f.handle(f.request("/api/auth/start", "POST"));
  // Client immediately cancels while begin is pending. It owns generation;
  // server response may arrive later but cannot write that cookie.
  f.jar.set(FENCE, f.deps.entropy());
  const generation = f.jar.get(FENCE);
  const late = await pending;
  f.apply(late);
  assert.equal(f.jar.get(FENCE), generation);
  assert.ok(
    late.headers.getSetCookie().every((v) => !v.startsWith(FENCE + "=")),
  );
  const body = await late.json();
  const state = new URL(body.authorizationUrl).searchParams.get("state");
  assert.equal(
    (await f.handle(f.request("/api/auth/callback?state=" + state + "&code=c")))
      .status,
    401,
  );
});

test("server-only authorization rechecks nonowner identity and mutation CSRF", async () => {
  const { authorizeCookie } = await import("./cookie-authorize.ts");
  const f = fixture();
  await f.login();
  const session = await (await f.handle(f.request("/api/auth/session"))).json();
  const result = await authorizeCookie(
    f.request("/api/issues", "POST", session.csrf),
    f.deps,
    true,
  );
  assert.equal(result.userId, "non-owner");
  assert.equal(result.accessToken, "synthetic-access");
  await assert.rejects(() =>
    authorizeCookie(f.request("/api/issues", "POST", "bad"), f.deps, true),
  );
  f.advance(600);
  await assert.rejects(() =>
    authorizeCookie(f.request("/api/issues"), f.deps, false),
  );
});
