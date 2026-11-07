import assert from "node:assert/strict";
import test from "node:test";
import { productionHandler } from "./application.ts";
import { FENCE, SESSION } from "./cookie-codec.ts";
import { createDevApplication, devDependencies } from "./dev-application.ts";
import { DEV_TOKEN_ROUTE } from "./dev-token.ts";
import { fence, jarOf, post, tokenDeps } from "./token-test-support.ts";
const dev = "https://nextjsdev.letmecome.in";
const api = "http://127.0.0.1:3002";
const login = (origin = dev, cookie?: string) =>
  post(api + DEV_TOKEN_ROUTE, "{}", origin, cookie);
test("dev token login issues a session the normal session route accepts", async () => {
  const handle = createDevApplication(tokenDeps());
  const result = await handle(login());
  assert.equal(result.status, 200);
  const jar = jarOf(result);
  assert.match(jar, new RegExp("^" + SESSION + "="));
  assert.doesNotMatch(await result.text(), /synthetic-token/);
  assert.doesNotMatch(result.headers.getSetCookie().join(), /synthetic-token/);
  const session = await handle(
    new Request(api + "/api/auth/session", {
      headers: {
        "sec-fetch-site": "same-origin",
        cookie: jar + "; " + FENCE + "=" + fence,
      },
    }),
  );
  assert.equal(session.status, 200);
  assert.equal((await session.json()).userId, "owner");
});
test("dev token login refuses a foreign origin and a bad token", async () => {
  const handle = createDevApplication(tokenDeps());
  assert.equal((await handle(login("https://evil.example"))).status, 403);
  const refused = await createDevApplication(tokenDeps({ token: "revoked" }))(
    login(),
  );
  assert.equal(refused.status, 401);
  assert.deepEqual(refused.headers.getSetCookie(), []);
  assert.equal((await handle(login(dev, ""))).status, 503);
});
test("dev token login is off without a token", async () => {
  assert.equal(
    (await createDevApplication(tokenDeps({ token: "" }))(login())).status,
    503,
  );
});
test("dev token login needs POST and a same-origin request", async () => {
  const handle = createDevApplication(tokenDeps());
  assert.equal(
    (
      await handle(
        new Request(api + DEV_TOKEN_ROUTE, { headers: { origin: dev } }),
      )
    ).status,
    405,
  );
  const crossSite = post(api + DEV_TOKEN_ROUTE, "{}", dev);
  crossSite.headers.set("sec-fetch-site", "cross-site");
  assert.equal((await handle(crossSite)).status, 403);
});
test("dev dependencies use a random session key, dev origins and a server-side token", () => {
  const a = devDependencies({ YOUTRACK_TOKEN: "synthetic-token" });
  const b = devDependencies({ YOUTRACK_TOKEN: "synthetic-token" });
  assert.notDeepEqual(a.key, b.key);
  assert.equal(a.token, "synthetic-token");
  assert.ok(a.origins.includes(dev));
  assert.ok(!a.origins.includes("https://romdex.vercel.app"));
});
test("production has no dev token route", async () => {
  const previous = process.env.ROMDEX_SESSION_KEY;
  process.env.ROMDEX_SESSION_KEY = Buffer.alloc(32, 3).toString("base64url");
  try {
    const result = await productionHandler(
      post("https://romdex.vercel.app" + DEV_TOKEN_ROUTE, "{}"),
    );
    assert.equal(result.status, 405);
    assert.deepEqual(result.headers.getSetCookie(), []);
  } finally {
    if (previous === undefined) delete process.env.ROMDEX_SESSION_KEY;
    else process.env.ROMDEX_SESSION_KEY = previous;
  }
});
