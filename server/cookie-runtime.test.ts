import assert from "node:assert/strict";
import test from "node:test";
import { FENCE, LOGIN, openCookie, SESSION } from "./cookie-codec.ts";
import { fixture } from "./cookie-fixture.ts";
const origin = "https://romdex.vercel.app";

test("actual encrypted HttpOnly cookie resumes non-owner, hides token, never retains refresh", async () => {
  const f = fixture();
  const flow = await f.login();
  assert.equal(new URL(flow.url).searchParams.get("access_type"), "online");
  assert.ok(!f.jar.get(SESSION)!.includes("synthetic-access"));
  const decoded = await openCookie(
    f.jar.get(SESSION)!,
    "session",
    f.deps.key,
    f.deps.now(),
  );
  assert.equal(decoded.accessToken, "synthetic-access");
  assert.ok(!JSON.stringify(decoded).includes("must-never-retain"));
  const result = await f.handle(f.request("/api/auth/session"));
  assert.equal(result.status, 200);
  assert.equal(result.headers.getSetCookie().length, 0);
  const text = await result.text();
  assert.ok(text.includes("non-owner"));
  assert.ok(!text.includes("synthetic-access"));
  f.advance(600);
  const expired = await f.handle(f.request("/api/auth/session"));
  assert.equal(expired.status, 401);
  assert.equal(expired.headers.getSetCookie().length, 0);
});
test("upstream expiry anchored before slow exchange/verification; no cookie past expiry", async () => {
  const f = fixture();
  const flow = await f.start();
  f.deps.oauth.exchange = async () => {
    f.advance(60);
    return { accessToken: "synthetic", expiresIn: 30 };
  };
  const result = await f.handle(
    f.request("/api/auth/callback?state=" + flow.state + "&code=c"),
  );
  assert.equal(result.status, 401);
  assert.equal(result.headers.getSetCookie().length, 0);
});
test("cancel fence rejects a late callback cookie without clearing a newer cookie on read", async () => {
  const f = fixture();
  const flow = await f.start();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  f.deps.oauth.exchange = async () => {
    await gate;
    return { accessToken: "synthetic", expiresIn: 600 };
  };
  const pending = f.handle(
    f.request("/api/auth/callback?state=" + flow.state + "&code=c"),
  );
  f.jar.set(FENCE, f.deps.entropy());
  const cancel = await f.handle(
    f.request("/api/auth/cancel", "POST", flow.csrf),
  );
  assert.equal(cancel.status, 200);
  f.apply(cancel);
  release();
  const late = await pending;
  assert.equal(late.status, 303);
  f.apply(late);
  const result = await f.handle(f.request("/api/auth/session"));
  assert.equal(result.status, 401);
  assert.equal(result.headers.getSetCookie().length, 0);
});
test("logout invalidates current fence; CSRF failure and forged/cross-purpose cookies fail closed", async () => {
  const f = fixture();
  await f.login();
  const result = await f.handle(f.request("/api/auth/session"));
  const body = await result.json();
  assert.equal(
    (await f.handle(f.request("/api/auth/logout", "POST", "bad"))).status,
    403,
  );
  const saved = f.jar.get(SESSION)!;
  f.jar.set(FENCE, f.deps.entropy());
  const logout = await f.handle(
    f.request("/api/auth/logout", "POST", body.csrf),
  );
  assert.equal(logout.status, 200);
  f.apply(logout);
  f.jar.set(SESSION, saved);
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
  f.jar.set(FENCE, "a".repeat(43));
  f.jar.set(SESSION, saved.slice(0, -5) + "wrong");
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
  const flow = await f.start();
  f.jar.set(SESSION, f.jar.get(LOGIN)!);
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
  assert.ok(flow.csrf);
});
test("changed identity and transient permission errors do not mutate cookies; wrong origins refused", async () => {
  const f = fixture();
  await f.login();
  f.deps.oauth.verify = async () => ({
    id: "other",
    guest: false,
    projects: [],
  });
  const changed = await f.handle(f.request("/api/auth/session"));
  assert.equal(changed.status, 401);
  assert.equal(changed.headers.getSetCookie().length, 0);
  f.deps.oauth.verify = async () => {
    throw new Error("private upstream URL");
  };
  const failed = await f.handle(f.request("/api/auth/session"));
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("private"));
  assert.equal(
    (
      await f.handle(
        new Request(origin + "/api/auth/start", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
            "sec-fetch-site": "cross-site",
          },
        }),
      )
    ).status,
    403,
  );
});

test("late login begin/callback cannot restore generation after another account begins", async () => {
  const f = fixture();
  const first = await f.start();
  const oldRequest = f.request(
    "/api/auth/callback?state=" + first.state + "&code=old",
  );
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  f.deps.oauth.exchange = async () => {
    await gate;
    return { accessToken: "old-account-token", expiresIn: 600 };
  };
  const pending = f.handle(oldRequest);
  await f.start();
  const currentGeneration = f.jar.get(FENCE);
  release();
  const late = await pending;
  f.apply(late);
  assert.equal(f.jar.get(FENCE), currentGeneration);
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
  assert.ok(
    late.headers.getSetCookie().every((v) => !v.startsWith(FENCE + "=")),
  );
});
