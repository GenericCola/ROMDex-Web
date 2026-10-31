import assert from "node:assert/strict";
import test from "node:test";
import { createApplication } from "./application.ts";
import { fixture } from "./cookie-fixture.ts";
test("authenticated read proxy preserves Gone and access failures without issuing deletion", async () => {
  const f = fixture();
  await f.login();
  const methods: string[] = [];
  let status = 410;
  const handle = createApplication({
    ...f.deps,
    fetch: async (_input, init) => {
      methods.push(init?.method ?? "GET");
      return new Response(null, { status });
    },
  });
  for (const expected of [410, 404, 403, 401]) {
    status = expected;
    const response = await handle(
      f.request(
        "/api/youtrack?route=" +
          encodeURIComponent("issues/PMON-1?fields=idReadable"),
      ),
    );
    assert.equal(response.status, expected);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
  assert.deepEqual(methods, ["GET", "GET", "GET", "GET"]);
});
