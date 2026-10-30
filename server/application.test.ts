import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import {
  createApplication,
  productionDependencies,
  productionHandler,
} from "./application.ts";
import { FENCE } from "./cookie-codec.ts";
import { fixture } from "./cookie-fixture.ts";
const origin = "https://romdex.vercel.app";
async function appFixture() {
  const f = fixture();
  f.deps.oauth.verify = async () => ({
    id: "non-owner",
    guest: false,
    projects: [{ id: "0-1", name: "PMON", shortName: "PMON" }],
  });
  await f.login();
  const session = await (await f.handle(f.request("/api/auth/session"))).json();
  const calls: { url: URL; init: RequestInit }[] = [];
  let metadataURL = "/api/files/1-2/file.txt",
    moved = false;
  const upstream: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    assert.equal(url.origin, "https://thegobindsingh.youtrack.cloud");
    assert.equal(init.redirect, "error");
    assert.equal(
      (init.headers as Record<string, string>).Authorization,
      "Bearer synthetic-access",
    );
    if (url.pathname === "/api/files/1-2/file.txt")
      return new Response(new Uint8Array([1, 2, 3]));
    if (init.method && init.method !== "GET")
      return Response.json({ id: "1-2", idReadable: "PMON-3" });
    if (url.pathname.endsWith("/attachments/1-2"))
      return Response.json({
        id: "1-2",
        size: 3,
        url: metadataURL,
        removed: false,
        draft: false,
      });
    if (url.pathname.endsWith("/customFields"))
      return Response.json([
        { id: "f-1", field: { name: "State", fieldType: { id: "state[1]" } } },
      ]);
    if (/^\/api\/issues\/(?:PMON-\d+|\d+-\d+)$/.test(url.pathname))
      return Response.json({
        id: "1-1",
        idReadable: moved ? "NPCD-1" : "PMON-1",
        project: {
          id: moved ? "0-2" : "0-1",
          shortName: moved ? "NPCD" : "PMON",
        },
        customFields: [
          { id: "f-1", name: "State", $type: "StateIssueCustomField" },
        ],
      });
    return Response.json([]);
  };
  const handle = createApplication({ ...f.deps, fetch: upstream });
  const request = (
    path: string,
    method = "GET",
    body?: BodyInit,
    extra: Record<string, string> = {},
  ) =>
    new Request(origin + path, {
      method,
      headers: {
        cookie: [...f.jar].map(([k, v]) => `${k}=${v}`).join("; "),
        origin,
        "sec-fetch-site": "same-origin",
        "x-romdex-csrf": session.csrf,
        ...extra,
      },
      ...(body === undefined ? {} : { body }),
    });
  const proxy = (route: string, method = "GET", body?: unknown) =>
    handle(
      request(
        "/api/youtrack?route=" + encodeURIComponent(route),
        method,
        body === undefined ? undefined : JSON.stringify(body),
        { "content-type": "application/json" },
      ),
    );
  return {
    ...f,
    handle,
    request,
    proxy,
    calls,
    session,
    move: () => {
      moved = true;
    },
    metadataURL: (url: string) => {
      metadataURL = url;
    },
  };
}
test("production entry fails closed without key/client; exact 32 byte canonical key only", async () => {
  for (const key of ["", "x", "A".repeat(42), "A".repeat(44)])
    assert.throws(() => productionDependencies({ ROMDEX_SESSION_KEY: key }));
  assert.equal(
    (await productionHandler(new Request(origin + "/api/auth/session"))).status,
    503,
  );
});
test("JSON runtime forwards only per-user authorization, no token/cookies in response", async () => {
  const f = await appFixture();
  const result = await f.proxy("issues?fields=id&query=project:PMON");
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.getSetCookie().length, 0);
  assert.ok(!(await result.text()).includes("synthetic-access"));
});
test("cross-origin, missing fetch metadata and wrong CSRF fail before any upstream dispatch", async () => {
  const f = await appFixture();
  for (const extra of [
    { "sec-fetch-site": "cross-site" },
    { origin: "https://evil.test" },
    { "x-romdex-csrf": "wrong" },
  ] as Record<string, string>[]) {
    const result = await f.handle(
      f.request(
        "/api/youtrack?route=issues%2FPMON-1",
        "POST",
        '{"summary":"x"}',
        { "content-type": "application/json", ...extra },
      ),
    );
    assert.equal(result.status, 403);
  }
  assert.equal(f.calls.length, 0);
});
test("admin/NPCD/SC001/URL traversal routes rejected without dispatch", async () => {
  const f = await appFixture();
  for (const route of [
    "admin/projects",
    "issues/NPCD-1",
    "issues/PMON-1/extension/SC001",
    "https://evil.test",
    "issues/PMON-1/../PMON-2",
    "issues/%2e%2e/users",
  ])
    assert.equal((await f.proxy(route, "POST", {})).status, 403);
  assert.equal(f.calls.length, 0);
});
test("fresh issue project binding blocks moved issue; create cannot name another project", async () => {
  const f = await appFixture();
  f.move();
  assert.equal(
    (await f.proxy("issues/PMON-1", "POST", { summary: "test" })).status,
    403,
  );
  assert.equal(
    (
      await f.proxy("issues", "POST", {
        summary: "test",
        project: { id: "0-2" },
      })
    ).status,
    403,
  );
  assert.equal(f.calls.filter((c) => c.init.method === "POST").length, 0);
});
test("write allowlist rejects project move/unknown schema; permits verified summary and custom field", async () => {
  const f = await appFixture();
  assert.equal(
    (await f.proxy("issues/PMON-1", "POST", { project: { id: "0-2" } })).status,
    403,
  );
  assert.equal(
    (
      await f.proxy("issues/PMON-1", "POST", {
        customFields: [
          {
            id: "unknown",
            name: "State",
            $type: "StateIssueCustomField",
            value: { name: "Open" },
          },
        ],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.proxy("issues/PMON-1", "POST", {
        summary: "test",
        customFields: [
          {
            id: "f-1",
            name: "State",
            $type: "StateIssueCustomField",
            value: { name: "Open" },
          },
        ],
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.proxy("issues", "POST", {
        summary: "test",
        project: { id: "0-1" },
        customFields: [
          {
            id: "f-1",
            name: "State",
            $type: "StateIssueCustomField",
            value: { name: "Open" },
          },
        ],
      })
    ).status,
    200,
  );
  assert.equal(f.calls.filter((c) => c.init.method === "POST").length, 2);
});
test("hierarchy target identity is freshly checked and cannot cross project", async () => {
  const f = await appFixture();
  assert.equal(
    (await f.proxy("issues/PMON-1/links/1-1t/issues", "POST", { id: "1-2" }))
      .status,
    200,
  );
  assert.ok(f.calls.some((c) => c.url.pathname === "/api/issues/1-2"));
});
test("small multipart upload forwards one validated file; large and extra fields never dispatch", async () => {
  const f = await appFixture();
  const form = new FormData();
  form.append("upload", new File(["abc"], "safe.txt"));
  assert.equal(
    (
      await f.handle(
        f.request(
          "/api/youtrack?route=issues%2FPMON-1%2Fattachments",
          "POST",
          form,
        ),
      )
    ).status,
    200,
  );
  const extra = new FormData();
  extra.append("upload", new File(["abc"], "safe.txt"));
  extra.append("admin", "true");
  assert.equal(
    (
      await f.handle(
        f.request(
          "/api/youtrack?route=issues%2FPMON-1%2Fattachments",
          "POST",
          extra,
        ),
      )
    ).status,
    413,
  );
  const large = new FormData();
  large.append("upload", new File([new Uint8Array(4_000_001)], "large.bin"));
  assert.equal(
    (
      await f.handle(
        f.request(
          "/api/youtrack?route=issues%2FPMON-1%2Fattachments",
          "POST",
          large,
        ),
      )
    ).status,
    413,
  );
  assert.equal(f.calls.filter((c) => c.init.method === "POST").length, 1);
});
test("download uses metadata-bound issue/id and streams exact bytes; client URL and malicious metadata refused", async () => {
  const f = await appFixture();
  let result = await f.handle(
    f.request("/api/attachment?issue=PMON-1&id=1-2&size=3"),
  );
  assert.equal(result.status, 200);
  assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], [1, 2, 3]);
  assert.equal(
    (await f.handle(f.request("/api/attachment?url=https://evil.test&size=3")))
      .status,
    400,
  );
  assert.equal(
    (await f.handle(f.request("/api/attachment?issue=PMON-1&id=1-2&size=4")))
      .status,
    409,
  );
  for (const url of [
    "https://evil.test/api/files/a",
    "https://thegobindsingh.youtrack.cloud/api/users/me",
    "https://user:pass@thegobindsingh.youtrack.cloud/api/files/a",
  ]) {
    f.metadataURL(url);
    result = await f.handle(
      f.request("/api/attachment?issue=PMON-1&id=1-2&size=3"),
    );
    assert.equal(result.status, 502);
  }
});
test("logout generation prevents old proxy requests and identity mismatch is rejected", async () => {
  const f = await appFixture();
  f.jar.set(FENCE, f.deps.entropy());
  assert.equal((await f.proxy("users/me")).status, 401);
  assert.equal(f.calls.length, 0);
  const g = await appFixture();
  g.deps.oauth.verify = async () => ({
    id: "other",
    guest: false,
    projects: [],
  });
  assert.equal((await g.proxy("users/me")).status, 401);
  assert.equal(g.calls.length, 0);
});
test("actual HTTP server executes same Web handler: login redirect cookie then authenticated proxy", async () => {
  const f = await appFixture();
  const server = createServer(async (req, res) => {
    try {
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers))
        if (val) headers.set(key, Array.isArray(val) ? val.join(",") : val);
      const request = new Request(origin + req.url, {
        method: req.method,
        headers,
        ...(["GET", "HEAD"].includes(req.method!)
          ? {}
          : ({
              body: Readable.toWeb(req) as ReadableStream,
              duplex: "half",
            } as RequestInit)),
      });
      const result = await f.handle(request);
      res.statusCode = result.status;
      result.headers.forEach((value, key) => {
        if (key !== "set-cookie") res.setHeader(key, value);
      });
      const cookies = result.headers.getSetCookie();
      if (cookies.length) res.setHeader("set-cookie", cookies);
      if (result.body)
        for await (const chunk of Readable.fromWeb(result.body as any))
          res.write(chunk);
      res.end();
    } catch {
      res.statusCode = 500;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    let headers = {
      origin: origin,
      "sec-fetch-site": "same-origin",
      cookie: `${FENCE}=${f.deps.entropy()}`,
    };
    let result = await fetch(base + "/api/auth/start", {
      method: "POST",
      headers,
    });
    assert.equal(result.status, 200);
    const loginCookie = result.headers.getSetCookie()[0]!.split(";")[0]!;
    const flow = await result.json();
    headers.cookie += "; " + loginCookie;
    result = await fetch(
      base +
        "/api/auth/callback?code=synthetic&state=" +
        new URL(flow.authorizationUrl).searchParams.get("state"),
      { headers, redirect: "manual" },
    );
    assert.equal(result.status, 303);
    assert.equal(result.headers.get("location"), origin + "/");
    const access = result.headers
      .getSetCookie()
      .find((v) => v.startsWith("__Host-romdex-access="))!;
    assert.match(access, /Secure; HttpOnly; SameSite=Lax/);
    headers.cookie += "; " + access.split(";")[0];
    result = await fetch(base + "/api/auth/session", { headers });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).userId, "non-owner");
    result = await fetch(base + "/api/youtrack?route=issues", { headers });
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("cache-control"), "no-store");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("long-lived upstream grant is capped to one hour; no refresh retained", async () => {
  const f = fixture();
  f.deps.oauth.exchange = async () => ({
    accessToken: "synthetic-access",
    expiresIn: 604800,
  });
  await f.login();
  const result = await (await f.handle(f.request("/api/auth/session"))).json();
  assert.equal(result.expiresAt - f.deps.now(), 3600);
});
test("actual Vercel entry exports the Web fetch handler and fails closed before setup", async () => {
  const entry = await import("../api/index.ts");
  assert.equal(typeof entry.default.fetch, "function");
  const result = await entry.default.fetch(
    new Request(origin + "/api/auth/session"),
  );
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("cache-control"), "no-store");
});
