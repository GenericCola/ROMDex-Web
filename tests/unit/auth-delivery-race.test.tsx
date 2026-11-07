import assert from "node:assert/strict";
import { test } from "node:test";
import { setAuthSession } from "../../src/auth/session";
import {
  connectDelivery,
  deliveryConnected,
  disconnectDelivery,
} from "../../src/cloud/session";
import { cloudData } from "../../src/cloud/types";
import { workspaceStore } from "../../src/domain/workspace-store";
import { labelledPersistence } from "../fixtures/memory-persistence";
import { deferred } from "../fixtures/values";
void test("signed-out pending connection cannot bind or activate delivery in the next account", async () => {
  const originalFetch = globalThis.fetch;
  const response = deferred<Response>();
  const started = deferred<void>();
  let requests = 0;
  globalThis.fetch = async (input, options) => {
    requests++;
    assert.equal(typeof input, "string");
    assert.match(input as string, /\/api\/users\/me\?fields=id$/);
    assert.equal(options?.method, "GET");
    assert.equal(
      new Headers(options?.headers).get("Authorization"),
      "Bearer fixture-A",
    );
    started.resolve();
    return response.promise;
  };
  const a = labelledPersistence("account A"),
    b = labelledPersistence("account B");
  try {
    disconnectDelivery();
    await workspaceStore.switchPersistence(a);
    setAuthSession({
      token: "fixture-A",
      expiresAt: Date.now() + 60000,
      userId: "1-1",
      projectId: "0-1",
    });
    const connecting = connectDelivery("fixture-A");
    const rejected = assert.rejects(
      connecting,
      /session changed|Connection changed/,
    );
    await started.promise;
    disconnectDelivery();
    setAuthSession(null);
    await workspaceStore.switchPersistence(b);
    setAuthSession({
      token: "fixture-B",
      expiresAt: Date.now() + 60000,
      userId: "1-2",
      projectId: "0-1",
    });
    response.resolve(
      new Response(JSON.stringify({ id: "1-1" }), { status: 200 }),
    );
    await rejected;
    assert.equal(requests, 1);
    assert.equal(deliveryConnected(), false);
    assert.equal(
      workspaceStore.getSnapshot().data.commentDrafts.label,
      "account B",
    );
    assert.equal(
      cloudData(workspaceStore.getSnapshot().data).accountId,
      undefined,
    );
    assert.equal(cloudData((await a.load()).data).accountId, undefined);
    assert.equal(cloudData((await b.load()).data).accountId, undefined);
  } finally {
    disconnectDelivery();
    setAuthSession(null);
    globalThis.fetch = originalFetch;
  }
});
