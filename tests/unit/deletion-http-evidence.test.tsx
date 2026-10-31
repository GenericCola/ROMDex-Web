import assert from "node:assert/strict";
import test from "node:test";
import { DeliveryClient } from "../../src/youtrack/delivery-client";
const run = async (status: number, identity = "owner", body?: unknown) => {
  const client = new DeliveryClient("synthetic-deletion-token");
  client.accountId = "owner";
  const original = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    return url.includes("users/me")
      ? Response.json({ id: identity })
      : new Response(body === undefined ? null : JSON.stringify(body), {
          status,
        });
  };
  try {
    return { state: await client.deletionState("PMON-900001"), requests };
  } finally {
    globalThis.fetch = original;
  }
};
test("real request boundary distinguishes404mask from410Gone and revalidates account", async () => {
  assert.deepEqual((await run(404)).state, { item: null, gone: false });
  assert.deepEqual((await run(410)).state, { item: null, gone: true });
  await assert.rejects(run(410, "different"), /account changed/);
  for (const status of [401, 403, 500])
    await assert.rejects(run(status), new RegExp(String(status)));
  await assert.rejects(run(200, "owner", null), /invalid task/);
  await assert.rejects(
    run(200, "owner", { idReadable: "PMON-9" }),
    /invalid task/,
  );
});
