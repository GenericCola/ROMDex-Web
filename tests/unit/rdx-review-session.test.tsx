import assert from "node:assert/strict";
import test from "node:test";
import { authIdentity, setAuthSession } from "../../src/auth/session";
import { workspaceStore } from "../../src/domain/workspace-store";
import { writeRdx } from "../../src/rdx/container";
import {
  PlanReviewSession,
  publicationInput,
} from "../../src/rdx/plan-review-session";
import { memoryPersistence } from "../fixtures/memory-persistence";
import { planDocument } from "../fixtures/rdx";
const signIn = (projectId = "0-1") => {
  setAuthSession({
    token: "fixture-only",
    userId: "1-1",
    projectId,
    expiresAt: Date.now() + 60000,
  });
};
const schemaFetch: typeof fetch = (input, init) => {
  assert.equal(init?.method, "GET");
  assert.equal(typeof input, "string");
  const url = new URL(input as string);
  let value: unknown;
  if (url.pathname === "/api/admin/projects")
    value = [{ id: "0-1", shortName: "PMON" }];
  else if (url.pathname.endsWith("/customFields"))
    value = ["State", "Priority", "Complexity", "Type"].map((name, index) => {
      return {
        id: "f-" + index,
        field: {
          name,
          fieldType: { id: index === 0 ? "state[1]" : "enum[1]" },
        },
      };
    });
  else
    value = [
      {
        id: "v-1",
        name: url.pathname.includes("f-0")
          ? "To do"
          : url.pathname.includes("f-1")
            ? "Normal"
            : url.pathname.includes("f-2")
              ? "MID"
              : "Task",
      },
    ];
  return Promise.resolve(new Response(JSON.stringify(value)));
};
void test("signed-in plan review stages only its exact local batch and never sends a mutation", async () => {
  const persisted = memoryPersistence();
  await workspaceStore.switchPersistence(persisted);
  const prior = globalThis.fetch;
  globalThis.fetch = schemaFetch;
  try {
    signIn();
    assert.deepEqual(authIdentity(), { userId: "1-1", projectId: "0-1" });
    const session = new PlanReviewSession(),
      bytes = await writeRdx(planDocument(), new Map());
    const preview = await session.preview(bytes, {});
    assert.equal(preview.ready, true);
    assert.equal(typeof preview.token, "string");
    if (typeof preview.token !== "string") throw Error("Missing preview token");
    assert.equal(persisted.data.operations.length, 0);
    await assert.rejects(
      session.queue(bytes, { token: preview.token }),
      /approval/,
    );
    await session.queue(bytes, { token: preview.token, approved: true });
    assert.equal(persisted.data.operations.length, 1);
    await assert.rejects(
      session.queue(bytes, { token: preview.token, approved: true }),
      /changed/,
    );
    assert.equal(persisted.data.operations.length, 1);
    setAuthSession(null);
    await assert.rejects(session.preview(bytes, {}), /session changed/);
  } finally {
    globalThis.fetch = prior;
    setAuthSession(null);
  }
});
void test("wrong selected project and cancelled pending schema cannot become a valid review", async () => {
  const prior = globalThis.fetch;
  try {
    globalThis.fetch = schemaFetch;
    signIn("0-99");
    await assert.rejects(new PlanReviewSession().refresh(), /Choose PMON/);
    signIn();
    const session = new PlanReviewSession();
    globalThis.fetch = (input, init) => {
      session.cancel();
      return schemaFetch(input, init);
    };
    await assert.rejects(session.refresh(), /review was closed/);
    assert.throws(() => {
      return publicationInput({ deletions: ["x", "x"] });
    }, /deletion review/);
    assert.throws(() => {
      return publicationInput({ choices: { x: true } });
    }, /review choices/);
  } finally {
    globalThis.fetch = prior;
    setAuthSession(null);
  }
});
