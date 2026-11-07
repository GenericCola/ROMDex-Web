import assert from "node:assert/strict";
import test from "node:test";
import { createApplication, productionDependencies } from "./application.ts";
import { FENCE, REMEMBER_SECONDS, SESSION } from "./cookie-codec.ts";
import { configuredOrigins, DEFAULT_ORIGINS } from "./session-contract.ts";
import { TOKEN_ROUTE, TOKEN_SESSION_SECONDS } from "./token-login.ts";
import { fence, jarOf, post, tokenDeps } from "./token-test-support.ts";
const app = "https://romdex.vercel.app";
const legacy = "https://romdex-web.vercel.app";
const handle = createApplication(tokenDeps({ origins: DEFAULT_ORIGINS }));
const paste = (body: unknown, origin = app, url = app + TOKEN_ROUTE) =>
  handle(post(url, JSON.stringify(body), origin));
const maxAge = (result: Response) =>
  Number(/Max-Age=(\d+)/.exec(result.headers.getSetCookie()[0] ?? "")?.[1]);
test("a good pasted token issues session cookies on every configured origin", async () => {
  for (const origin of DEFAULT_ORIGINS) {
    const result = await paste(
      { token: "synthetic-token" },
      origin,
      origin + TOKEN_ROUTE,
    );
    assert.equal(result.status, 200);
    assert.match(jarOf(result), new RegExp("^" + SESSION + "="));
    assert.doesNotMatch(await result.text(), /synthetic-token/);
    assert.doesNotMatch(
      result.headers.getSetCookie().join(),
      /synthetic-token/,
    );
    assert.equal(maxAge(result), TOKEN_SESSION_SECONDS);
  }
  const kept = await paste({ token: "synthetic-token", rememberDevice: true });
  assert.equal(maxAge(kept), REMEMBER_SECONDS);
});
test("a bad pasted token is refused without detail or cookies", async () => {
  const result = await paste({ token: "revoked-token" });
  assert.equal(result.status, 401);
  assert.deepEqual(result.headers.getSetCookie(), []);
  const text = await result.text();
  assert.doesNotMatch(text, /revoked|bad token/);
  assert.equal((await paste({ token: "" })).status, 400);
  assert.equal(
    (await paste({ token: "synthetic-token", extra: 1 })).status,
    400,
  );
});
test("pasted tokens are refused from a wrong origin or with an oversized body", async () => {
  assert.equal(
    (await paste({ token: "synthetic-token" }, "https://evil.example")).status,
    403,
  );
  assert.equal(
    (
      await paste(
        { token: "synthetic-token" },
        "https://evil.example",
        "https://evil.example" + TOKEN_ROUTE,
      )
    ).status,
    403,
  );
  const cross = await handle(
    new Request(app + TOKEN_ROUTE, {
      method: "POST",
      headers: {
        origin: app,
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
        cookie: FENCE + "=" + fence,
      },
      body: JSON.stringify({ token: "synthetic-token" }),
    }),
  );
  assert.equal(cross.status, 403);
  assert.equal((await paste({ token: "x".repeat(2000) })).status, 400);
});
test("signing out clears a pasted-token session cookie", async () => {
  const login = await paste({ token: "synthetic-token" });
  const session = await handle(
    new Request(app + "/api/auth/session", {
      headers: {
        "sec-fetch-site": "same-origin",
        cookie: jarOf(login) + "; " + FENCE + "=" + fence,
      },
    }),
  );
  const { csrf } = await session.json();
  const out = await handle(
    new Request(app + "/api/auth/logout", {
      method: "POST",
      headers: {
        origin: app,
        "sec-fetch-site": "same-origin",
        "x-romdex-csrf": csrf,
        cookie: jarOf(login) + "; " + FENCE + "=" + "g".repeat(43),
      },
    }),
  );
  assert.equal(out.status, 200);
  assert.match(
    out.headers.getSetCookie()[0] ?? "",
    new RegExp("^" + SESSION + "=;.*Max-Age=0"),
  );
});
test("OAuth starts only at the registered origin", async () => {
  const result = await handle(post(legacy + "/api/auth/start", "{}", legacy));
  assert.equal(result.status, 403);
});
test("origins come from ROMDEX_ORIGINS, with production defaults unchanged", () => {
  assert.deepEqual(configuredOrigins({}), [app, legacy]);
  assert.deepEqual(
    configuredOrigins({
      ROMDEX_ORIGINS: " https://a.example, http://localhost:3000 ",
    }),
    ["https://a.example", "http://localhost:3000"],
  );
  assert.throws(() =>
    configuredOrigins({ ROMDEX_ORIGINS: "https://a.example/path" }),
  );
  const key = Buffer.alloc(32, 3).toString("base64url");
  assert.deepEqual(
    productionDependencies({ ROMDEX_SESSION_KEY: key }).origins,
    [app, legacy],
  );
});
