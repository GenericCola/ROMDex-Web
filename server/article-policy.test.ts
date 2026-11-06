import assert from "node:assert/strict";
import test from "node:test";
import { createApplication } from "./application.ts";
import { fixture } from "./cookie-fixture.ts";
const origin = "https://romdex.vercel.app";
const visible = {
  $type: "LimitedVisibility",
  permittedUsers: [{ id: "2-1" }, { id: "2-2" }],
};
const articles: Record<string, { summary: string; project: string }> = {
  "186-6": { summary: "ROMDex data", project: "PMON" },
  "187-1": { summary: "NPCDex data", project: "NPCD" },
  "188-1": { summary: "ROMDex data", project: "NPCD" },
  "189-1": { summary: "Notes", project: "PMON" },
  "TST-A-1": { summary: "ROMDex data", project: "TST" },
};
const ids: Record<string, string> = { PMON: "0-1", NPCD: "0-2", TST: "0-3" };
async function articleFixture() {
  const f = fixture();
  f.deps.oauth.verify = async () => ({
    id: "non-owner",
    guest: false,
    projects: [
      { id: "0-1", name: "PMON", shortName: "PMON" },
      { id: "0-2", name: "NPCD", shortName: "NPCD" },
    ],
  });
  await f.login();
  const session = await (await f.handle(f.request("/api/auth/session"))).json();
  const calls: { url: URL; init: RequestInit }[] = [];
  const upstream: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname === "/api/files/9-9/data.bin")
      return new Response(new Uint8Array([1, 2, 3]));
    if (init.method && init.method !== "GET")
      return Response.json({ id: "186-6" });
    const attachment = /^\/api\/articles\/([^/]+)\/attachments\/1-2$/.exec(
      url.pathname,
    );
    if (attachment)
      return Response.json({
        id: "1-2",
        size: 3,
        url: "/api/files/9-9/data.bin",
        removed: false,
      });
    const article = /^\/api\/articles\/([^/]+)$/.exec(url.pathname);
    const found = article && articles[article[1]!];
    if (found)
      return Response.json({
        id: article[1],
        summary: found.summary,
        project: { id: ids[found.project], shortName: found.project },
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
  const proxy = async (route: string, method = "GET", body?: unknown) => {
    const before = calls.filter((c) => c.init.method === method).length;
    const result = await handle(
      request(
        "/api/youtrack?route=" + encodeURIComponent(route),
        method,
        body === undefined ? undefined : JSON.stringify(body),
        { "content-type": "application/json" },
      ),
    );
    const writes =
      calls.filter((c) => c.init.method === method).length - before;
    return { status: result.status, writes };
  };
  return { handle, request, proxy, calls };
}
const create = {
  project: { id: "0-1" },
  summary: "ROMDex data",
  content: "{}",
  visibility: visible,
};
test("article create accepts only the exact store body", async () => {
  const f = await articleFixture();
  assert.deepEqual(await f.proxy("articles", "POST", create), {
    status: 200,
    writes: 1,
  });
  assert.equal(
    (
      await f.proxy("articles", "POST", {
        ...create,
        summary: "NPCDex data",
        project: { id: "0-2" },
        visibility: {
          ...visible,
          permittedUsers: [{ id: "2-2" }, { id: "2-1" }],
        },
      })
    ).status,
    200,
  );
  const bad: unknown[] = [
    { ...create, summary: "NPCDex data" },
    { ...create, summary: "Other" },
    { ...create, project: { id: "0-3" } },
    { ...create, project: { id: "0-1", extra: 1 } },
    { ...create, extra: 1 },
    { project: create.project, summary: create.summary, content: "{}" },
    { ...create, content: "x".repeat(1_000_001) },
    { ...create, content: 5 },
    { ...create, visibility: undefined },
    {
      ...create,
      visibility: {
        $type: "LimitedVisibility",
        permittedUsers: [{ id: "2-1" }],
      },
    },
    {
      ...create,
      visibility: {
        ...visible,
        permittedUsers: [{ id: "2-1" }, { id: "2-2" }, { id: "2-3" }],
      },
    },
    {
      ...create,
      visibility: {
        ...visible,
        permittedUsers: [{ id: "2-1" }, { id: "2-3" }],
      },
    },
    {
      ...create,
      visibility: {
        ...visible,
        permittedUsers: [{ id: "2-1" }, { id: "2-1" }],
      },
    },
    {
      ...create,
      visibility: {
        ...visible,
        permittedUsers: [{ id: "2-1" }, { id: "2-2", name: "x" }],
      },
    },
    { ...create, visibility: { ...visible, permittedGroups: [] } },
  ];
  for (const body of bad) {
    const result = await f.proxy("articles", "POST", body);
    assert.ok(result.status >= 400, JSON.stringify(body));
    assert.equal(result.writes, 0);
  }
});
test("article update requires a store article and only content", async () => {
  const f = await articleFixture();
  assert.equal(
    (await f.proxy("articles/186-6", "POST", { content: "x" })).writes,
    1,
  );
  assert.equal(
    (await f.proxy("articles/187-1", "POST", { content: "x" })).writes,
    1,
  );
  for (const [id, body] of [
    ["188-1", { content: "x" }],
    ["189-1", { content: "x" }],
    ["TST-A-1", { content: "x" }],
    ["186-6", { content: "x", summary: "y" }],
    ["186-6", { summary: "y" }],
    ["186-6", { content: "x".repeat(1_000_001) }],
    ["186-6", { content: 1 }],
  ] as const) {
    const result = await f.proxy("articles/" + id, "POST", body);
    assert.ok(result.status >= 400, id);
    assert.equal(result.writes, 0);
  }
});
test("article upload is limited to store articles", async () => {
  const f = await articleFixture();
  const send = async (id: string) => {
    const form = new FormData();
    form.append("upload", new File(["abc"], "a.txt"));
    return (
      await f.handle(
        f.request(
          "/api/youtrack?route=" +
            encodeURIComponent(`articles/${id}/attachments`),
          "POST",
          form,
        ),
      )
    ).status;
  };
  assert.equal(await send("186-6"), 200);
  assert.equal(await send("189-1"), 403);
  assert.equal(f.calls.filter((c) => c.init.method === "POST").length, 1);
});
test("article download checks the store article and size", async () => {
  const f = await articleFixture();
  const get = (query: string) =>
    f.handle(f.request("/api/attachment?" + query));
  const ok = await get("article=186-6&id=1-2&size=3");
  assert.equal(ok.status, 200);
  assert.deepEqual([...new Uint8Array(await ok.arrayBuffer())], [1, 2, 3]);
  assert.equal((await get("article=186-6&id=1-2&size=4")).status, 409);
  assert.equal((await get("article=189-1&id=1-2&size=3")).status, 403);
  assert.equal((await get("article=TST-A-1&id=1-2&size=3")).status, 403);
  assert.equal((await get("article=bad&id=1-2&size=3")).status, 400);
  assert.equal(
    (await get("article=186-6&issue=PMON-1&id=1-2&size=3")).status,
    400,
  );
  assert.equal((await get("id=1-2&size=3")).status, 400);
  assert.equal(
    (await get("article=186-6&article=187-1&id=1-2&size=3")).status,
    400,
  );
});
