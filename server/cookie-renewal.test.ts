import assert from "node:assert/strict";
import test from "node:test";
import {
  FENCE,
  LOGIN,
  openCookie,
  REMEMBER_SECONDS,
  RENEWAL,
  sealCookie,
  SESSION,
} from "./cookie-codec.ts";
import { fixture } from "./cookie-fixture.ts";
import { HttpFailure } from "./runtime-types.ts";

async function rememberedFixture(rememberDevice = true) {
  const f = fixture();
  let calls = 0;
  f.deps.oauth.refresh = async () => {
    calls++;
    return {
      accessToken: "renewed-access",
      expiresIn: 300,
      refreshToken: "renewed-refresh",
    };
  };
  const post = (
    path: string,
    body: unknown,
    csrf?: string,
    headers: Record<string, string> = {},
  ) => {
    const request = f.request(path, "POST", csrf);
    return new Request(request, {
      headers: {
        ...Object.fromEntries(request.headers),
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };
  f.jar.set(FENCE, f.deps.entropy());
  const start = await f.handle(post("/api/auth/start", { rememberDevice }));
  assert.equal(start.status, 200);
  f.apply(start);
  const flow = await start.json();
  const url = new URL(flow.authorizationUrl);
  const result = await f.handle(
    f.request(
      "/api/auth/callback?state=" +
        url.searchParams.get("state") +
        "&code=synthetic",
    ),
  );
  assert.equal(result.status, 303);
  f.apply(result);
  const challenge = async () => {
    const response = await f.handle(f.request("/api/auth/session"));
    assert.equal(response.status, 401);
    assert.equal(response.headers.getSetCookie().length, 0);
    return response.json();
  };
  return {
    ...f,
    post,
    challenge,
    url,
    loginResponse: result,
    calls: () => calls,
  };
}

test("only encrypted explicit opt-in requests offline and stores encrypted bounded renewal authority", async () => {
  const f = await rememberedFixture();
  assert.equal(f.url.searchParams.get("access_type"), "offline");
  const value = await openCookie(
    f.jar.get(RENEWAL)!,
    "renewal",
    f.deps.key,
    f.deps.now(),
  );
  assert.equal(value.refreshToken, "must-never-retain");
  assert.equal(value.expiresAt - f.deps.now(), REMEMBER_SECONDS);
  assert.equal(value.accessExpiresAt! - f.deps.now(), 600);
  assert.equal(value.userId, "non-owner");
  for (const cookie of f.loginResponse.headers.getSetCookie()) {
    assert.match(cookie, /Path=\/; Secure; HttpOnly; SameSite=Lax/);
    assert.ok(Buffer.byteLength(cookie) <= 3900);
    assert.ok(!cookie.includes("must-never-retain"));
    assert.ok(!cookie.includes("synthetic-access"));
  }
  const g = await rememberedFixture(false);
  assert.equal(g.url.searchParams.get("access_type"), "online");
  assert.equal(g.jar.has(RENEWAL), false);
  assert.equal(g.calls(), 0);
});

test("expiry exposes only renewal challenge; POST rotates once then verified access resumes", async () => {
  const f = await rememberedFixture();
  const original = await openCookie(
    f.jar.get(RENEWAL)!,
    "renewal",
    f.deps.key,
    f.deps.now(),
  );
  f.advance(600);
  const challenge = await f.challenge();
  assert.deepEqual(Object.keys(challenge).sort(), [
    "csrf",
    "renewUntil",
    "renewable",
    "renewalId",
  ]);
  assert.equal(challenge.renewable, true);
  assert.equal(f.calls(), 0);
  const renewed = await f.handle(
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
    ),
  );
  assert.equal(renewed.status, 200);
  assert.deepEqual(await renewed.json(), { renewed: true });
  f.apply(renewed);
  const next = await openCookie(
    f.jar.get(RENEWAL)!,
    "renewal",
    f.deps.key,
    f.deps.now(),
  );
  assert.equal(next.expiresAt, original.expiresAt);
  assert.equal(next.issuedAt, original.issuedAt);
  assert.equal(next.sessionId, original.sessionId);
  assert.notEqual(next.renewalId, original.renewalId);
  assert.equal(next.refreshToken, "renewed-refresh");
  const session = await f.handle(f.request("/api/auth/session"));
  assert.equal(session.status, 200);
  assert.equal(session.headers.getSetCookie().length, 0);
  assert.equal((await session.json()).userId, "non-owner");
  assert.equal(f.calls(), 1);
});

test("cross-origin, CSRF, nonce, method and bounded input failures never dispatch renewal", async () => {
  const f = await rememberedFixture();
  f.advance(600);
  const challenge = await f.challenge();
  const requests = [
    f.request("/api/auth/renew"),
    f.post("/api/auth/renew", { renewalId: challenge.renewalId }, "bad"),
    f.post("/api/auth/renew", { renewalId: "bad" }, challenge.csrf),
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
      { origin: "https://evil.example" },
    ),
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
      { "sec-fetch-site": "cross-site" },
    ),
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId, extra: true },
      challenge.csrf,
    ),
    f.post("/api/auth/renew", { renewalId: "x".repeat(300) }, challenge.csrf),
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
      { "content-type": "text/plain" },
    ),
  ];
  for (const request of requests) {
    const response = await f.handle(request);
    assert.ok(response.status >= 400);
    assert.equal(response.headers.getSetCookie().length, 0);
  }
  assert.equal(f.calls(), 0);
});

test("upstream revocation does not downgrade to renewal and malformed live access does not refresh", async () => {
  const f = await rememberedFixture();
  f.deps.oauth.verify = async () => {
    throw new HttpFailure(401);
  };
  let response = await f.handle(f.request("/api/auth/session"));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).renewable, undefined);
  f.jar.set(SESSION, "corrupt");
  response = await f.handle(f.request("/api/auth/session"));
  assert.equal((await response.json()).renewable, undefined);
  assert.equal(f.calls(), 0);
});

test("fixed deadline and upstream access TTL remain independent through late renewal", async () => {
  const f = await rememberedFixture();
  const original = await openCookie(
    f.jar.get(RENEWAL)!,
    "renewal",
    f.deps.key,
    f.deps.now(),
  );
  f.advance(REMEMBER_SECONDS - 10);
  const challenge = await f.challenge();
  const renewed = await f.handle(
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
    ),
  );
  assert.equal(renewed.status, 200);
  f.apply(renewed);
  const session = await openCookie(
    f.jar.get(SESSION)!,
    "session",
    f.deps.key,
    f.deps.now(),
  );
  assert.equal(session.expiresAt, original.expiresAt);
  f.advance(10);
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
  assert.equal(
    (
      await f.handle(
        f.post(
          "/api/auth/renew",
          { renewalId: challenge.renewalId },
          challenge.csrf,
        ),
      )
    ).status,
    401,
  );
  assert.equal(f.calls(), 1);
});

for (const scenario of [
  "different-user",
  "different-scope",
  "oversized",
  "invalid-ttl",
  "provider-loss",
  "expiry-during-refresh",
])
  test(`renewal ${scenario} fails closed without cookie changes or automatic replay`, async () => {
    const f = await rememberedFixture();
    f.advance(600);
    const challenge = await f.challenge();
    const before = [...f.jar];
    let calls = 0;
    f.deps.oauth.refresh = async () => {
      calls++;
      if (scenario === "provider-loss") throw Error("secret provider detail");
      if (scenario === "expiry-during-refresh") f.advance(REMEMBER_SECONDS);
      return {
        accessToken: "renewed-access",
        expiresIn: scenario === "invalid-ttl" ? 0 : 300,
        refreshToken: scenario === "oversized" ? "x".repeat(5000) : "rotated",
        ...(scenario === "different-scope" ? { scope: "YouTrack extra" } : {}),
      };
    };
    if (scenario === "different-user")
      f.deps.oauth.verify = async () => ({
        id: "other",
        guest: false,
        projects: [],
      });
    const result = await f.handle(
      f.post(
        "/api/auth/renew",
        { renewalId: challenge.renewalId },
        challenge.csrf,
      ),
    );
    assert.ok(result.status >= 400);
    assert.equal(result.headers.getSetCookie().length, 0);
    assert.ok(!(await result.text()).includes("secret"));
    assert.deepEqual([...f.jar], before);
    assert.equal(calls, 1);
  });

test("nonrotating provider retains old refresh value, but issues a new attempt identity", async () => {
  const f = await rememberedFixture();
  f.advance(600);
  const challenge = await f.challenge();
  f.deps.oauth.refresh = async () => ({ accessToken: "next", expiresIn: 120 });
  const result = await f.handle(
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
    ),
  );
  assert.equal(result.status, 200);
  f.apply(result);
  const value = await openCookie(
    f.jar.get(RENEWAL)!,
    "renewal",
    f.deps.key,
    f.deps.now(),
  );
  assert.equal(value.refreshToken, "must-never-retain");
  assert.notEqual(value.renewalId, challenge.renewalId);
});

test("late renewal response cannot restore generation after logout or a new account starts", async () => {
  for (const action of ["logout", "new-login"]) {
    const f = await rememberedFixture();
    f.advance(600);
    const challenge = await f.challenge();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    f.deps.oauth.refresh = async () => {
      await gate;
      return {
        accessToken: "late",
        expiresIn: 300,
        refreshToken: "late-renew",
      };
    };
    const pending = f.handle(
      f.post(
        "/api/auth/renew",
        { renewalId: challenge.renewalId },
        challenge.csrf,
      ),
    );
    await Promise.resolve();
    f.jar.set(FENCE, f.deps.entropy());
    const latestFence = f.jar.get(FENCE);
    if (action === "new-login") {
      const newer = await f.handle(
        f.post("/api/auth/start", { rememberDevice: false }),
      );
      f.apply(newer);
    }
    release();
    const late = await pending;
    assert.equal(late.status, 200);
    f.apply(late);
    assert.equal(f.jar.get(FENCE), latestFence);
    const read = await f.handle(f.request("/api/auth/session"));
    assert.equal(read.status, 401);
    assert.equal((await read.json()).renewable, undefined);
    assert.equal(read.headers.getSetCookie().length, 0);
  }
});

test("purpose/client/generation and malformed deadline checks protect renewal envelope", async () => {
  const f = await rememberedFixture();
  const original = f.jar.get(RENEWAL)!;
  const value = await openCookie(original, "renewal", f.deps.key, f.deps.now());
  for (const patch of [
    { expiresAt: value.expiresAt + 1 },
    { userId: "" },
    { clientId: "other-client" },
    { accessExpiresAt: value.expiresAt + 1 },
    { renewalId: "invalid" },
  ]) {
    f.jar.set(RENEWAL, await sealCookie({ ...value, ...patch }, f.deps.key));
    f.jar.delete(SESSION);
    assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
  }
  f.jar.set(RENEWAL, f.jar.get(LOGIN) ?? "wrong-purpose");
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
  f.jar.set(RENEWAL, original);
  f.jar.set(FENCE, f.deps.entropy());
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 401);
});

test("missing provider refresh grant leaves access-only session despite requested remember choice", async () => {
  const f = fixture();
  f.deps.oauth.exchange = async () => ({
    accessToken: "synthetic-only",
    expiresIn: 600,
  });
  f.jar.set(FENCE, f.deps.entropy());
  const req = f.request("/api/auth/start", "POST");
  const start = await f.handle(
    new Request(req, {
      headers: {
        ...Object.fromEntries(req.headers),
        "content-type": "application/json",
      },
      body: JSON.stringify({ rememberDevice: true }),
    }),
  );
  f.apply(start);
  const body = await start.json();
  const result = await f.handle(
    f.request(
      "/api/auth/callback?state=" +
        new URL(body.authorizationUrl).searchParams.get("state") +
        "&code=synthetic",
    ),
  );
  assert.equal(result.status, 303);
  f.apply(result);
  assert.equal(f.jar.has(RENEWAL), false);
  const active = await f.handle(f.request("/api/auth/session"));
  assert.equal(active.status, 200);
  const activeBody = await active.json();
  assert.equal(activeBody.rememberDeviceRequested, true);
  assert.equal(activeBody.remembered, false);
  assert.equal(activeBody.renewUntil, undefined);
  f.advance(600);
  const expired = await f.handle(f.request("/api/auth/session"));
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).renewable, undefined);
});

test("reversed concurrent rotation responses keep identity and deadline bound, with fail-closed stale-token fallback", async () => {
  const f = await rememberedFixture();
  f.advance(600);
  const challenge = await f.challenge();
  const original = await openCookie(
    f.jar.get(RENEWAL)!,
    "renewal",
    f.deps.key,
    f.deps.now(),
  );
  const releases: Array<() => void> = [];
  let calls = 0;
  f.deps.oauth.refresh = async () => {
    const index = ++calls;
    await new Promise<void>((resolve) => {
      releases[index - 1] = resolve;
    });
    return {
      accessToken: "concurrent-access-" + index,
      expiresIn: 300,
      refreshToken: "concurrent-renew-" + index,
    };
  };
  const request = () =>
    f.post(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
    );
  const first = f.handle(request()),
    second = f.handle(request());
  while (releases.length < 2)
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  releases[1]!();
  const response2 = await second;
  f.apply(response2);
  releases[0]!();
  const response1 = await first;
  f.apply(response1);
  const stale = await openCookie(
    f.jar.get(RENEWAL)!,
    "renewal",
    f.deps.key,
    f.deps.now(),
  );
  assert.equal(stale.userId, original.userId);
  assert.equal(stale.fence, original.fence);
  assert.equal(stale.expiresAt, original.expiresAt);
  assert.equal(stale.sessionId, original.sessionId);
  assert.equal((await f.handle(f.request("/api/auth/session"))).status, 200);
  f.advance(300);
  const next = await f.challenge();
  f.deps.oauth.refresh = async () => {
    calls++;
    throw new HttpFailure(400);
  };
  const failed = await f.handle(
    f.post("/api/auth/renew", { renewalId: next.renewalId }, next.csrf),
  );
  assert.equal(failed.status, 400);
  assert.equal(failed.headers.getSetCookie().length, 0);
  assert.equal(calls, 3);
});
