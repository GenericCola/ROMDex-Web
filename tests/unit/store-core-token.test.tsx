import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { tokenTransport } from "../../src/store/core/token-transport.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Seen {
  url: string;
  headers: Record<string, string>;
}

const stub = (respond: () => Response) => {
  const seen: Seen[] = [];
  globalThis.fetch = (input, init) => {
    seen.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return Promise.resolve(respond());
  };
  return seen;
};

const transport = tokenTransport("https://yt.example", "perm-secret");

test("requests carry the bearer token and parse JSON", async () => {
  const seen = stub(() => Response.json([{ id: "1" }]));
  assert.deepEqual(await transport.request("articles?fields=id"), [
    { id: "1" },
  ]);
  assert.equal(seen[0]?.url, "https://yt.example/api/articles?fields=id");
  assert.equal(seen[0]?.headers.Authorization, "Bearer perm-secret");
});

test("a 404 GET answers null, other statuses fail without the token", async () => {
  stub(() => new Response("", { status: 404 }));
  assert.equal(await transport.request("articles/1-1"), null);
  await assert.rejects(
    transport.request("articles/1-1", "GET", undefined, true),
  );
  stub(() => new Response("perm-secret", { status: 500 }));
  await assert.rejects(
    transport.request("articles/1-1?fields=x"),
    (error: Error) => {
      assert.match(error.message, /500 to GET articles\/1-1\./);
      assert.ok(!error.message.includes("perm-secret"));
      return true;
    },
  );
});

test("download checks origin, path and exact size", async () => {
  stub(() => new Response(new Uint8Array([1, 2, 3])));
  const target = { article: "1-1", id: "1-2" };
  assert.deepEqual(
    await transport.download("/api/files/abc?sign=x", 3, target),
    new Uint8Array([1, 2, 3]),
  );
  await assert.rejects(
    transport.download("https://evil.example/api/files/abc", 3, target),
    /unapproved/,
  );
  await assert.rejects(
    transport.download("/api/users/me", 3, target),
    /unapproved/,
  );
  await assert.rejects(
    transport.download("/api/files/abc", 2, target),
    /larger/,
  );
  await assert.rejects(
    transport.download("/api/files/abc", 4, target),
    /smaller/,
  );
});
