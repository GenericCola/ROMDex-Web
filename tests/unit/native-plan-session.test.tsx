import assert from "node:assert/strict";
import test from "node:test";
import { setAuthSession } from "../../src/auth/session";
import { jsonObject } from "../../src/domain/json";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
import { documentRevision, readRdx, writeRdx } from "../../src/rdx/container";
import { inspectRdx } from "../../src/rdx/inspect";
import { fileBytes, rdxFile } from "../../src/rdx/library";
import { NativePlanSession } from "../../src/rdx/native-plan-session";
import { planKey } from "../../src/rdx/plan-documents";
import { PlanReviewSession } from "../../src/rdx/plan-review-session";
import { normalize } from "../../src/youtrack/read-tasks";
import { rawIssue } from "../fixtures/native-field-delivery";
import { planDocument } from "../fixtures/rdx";
void test("native plan review retains old bytes and atomically saves the new plan and bindings without remote mutation", async (t) => {
  const document = planDocument(),
    bytes = await writeRdx(document, new Map()),
    file = rdxFile(
      "fixture.rdx",
      await inspectRdx({ action: "inspect", bytes, planOnly: true }),
    ),
    data = emptyWorkspace(),
    key = planKey(file),
    raw = rawIssue();
  const portable = jsonObject(
    (jsonObject(document.content).tasks as never[])[0],
  );
  data.rdxFiles = [file];
  data.remote = [normalize(raw)];
  data.rdxImports = {
    [key]: {
      tasks: {
        "task:fixture": {
          issueId: "PMON-1",
          desired: { parentId: null },
          portable,
        },
      },
      batches: {},
    },
  };
  const before = structuredClone(data),
    snapshot = workspaceStore.getSnapshot();
  t.mock.method(workspaceStore, "getSnapshot", () => ({
    ...snapshot,
    ready: true,
    error: "",
    data,
  }));
  t.mock.method(workspaceStore, "flush", async () => {});
  t.mock.method(
    workspaceStore,
    "change",
    async (
      update: (data: import("../../src/domain/types").WorkspaceData) => void,
    ) => {
      update(data);
    },
  );
  const fields = new PlanReviewSession();
  t.mock.method(fields, "refresh", async () => {});
  t.mock.method(fields, "fieldOptions", () => ({}));
  const methods: string[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: Parameters<typeof fetch>[0], init: RequestInit | undefined) => {
      methods.push(init?.method ?? "GET");
      assert.equal(init?.method, "GET");
      const path = new URL(String(url)).pathname;
      return Response.json(
        path.endsWith("/comments") || path.endsWith("/attachments") ? [] : raw,
      );
    },
  );
  setAuthSession({
    token: "fixture-only",
    expiresAt: Date.now() + 60000,
    userId: "fixture",
    projectId: "0-1",
  });
  t.after(() => setAuthSession(null));
  const result = await new NativePlanSession().review({ key }, fields);
  assert.equal("resolved" in result && result.resolved, true);
  assert.equal(data.rdxFiles.length, 2);
  assert.deepEqual(data.rdxFiles[0], file);
  assert.deepEqual(data.remote, before.remote);
  assert.deepEqual(data.operations, []);
  const saved = await readRdx(fileBytes(data.rdxFiles.at(-1)!));
  assert.equal(
    jsonObject((jsonObject(saved.document.content).tasks as never[])[0]).title,
    "Fixture",
  );
  assert.equal(data.rdxImports[key]?.tasks["task:fixture"]?.pulledUpdated, 1);
  assert.ok(methods.length >= 6);
  // Divergent local/native edits require the exact displayed review token.
  const local = structuredClone(saved.document);
  jsonObject((jsonObject(local.content).tasks as never[])[0]).title =
    "Local edit";
  local.revision = documentRevision(local);
  data.rdxFiles.push(
    rdxFile(
      "fixture.rdx",
      await inspectRdx({
        action: "inspect",
        bytes: await writeRdx(local, saved.blobs),
        planOnly: true,
      }),
    ),
  );
  raw.summary = "Remote edit";
  raw.updated = 2;
  const session = new NativePlanSession();
  const review = await session.review(
    { key, choices: { "task:fixture:title": "incoming" } },
    fields,
  );
  assert.equal(review.conflicts.length, 1); // sync-review cannot smuggle approval.
  const kept = data.rdxFiles.length;
  assert.equal(
    jsonObject((jsonObject(local.content).tasks as never[])[0]).title,
    "Local edit",
  );
  assert.ok("token" in review);
  raw.summary = "Remote changed again";
  raw.updated = 3;
  await assert.rejects(
    session.review(
      {
        key,
        approved: true,
        token: review.token,
        choices: { "task:fixture:title": "incoming" },
      },
      fields,
      true,
    ),
    /evidence changed/,
  );
  assert.equal(data.rdxFiles.length, kept);
  const refreshed = await session.review({ key }, fields);
  assert.ok("token" in refreshed);
  await session.review(
    {
      key,
      approved: true,
      token: refreshed.token,
      choices: { "task:fixture:title": "incoming" },
    },
    fields,
    true,
  );
  const accepted = await readRdx(fileBytes(data.rdxFiles.at(-1)!));
  assert.equal(
    jsonObject((jsonObject(accepted.document.content).tasks as never[])[0])
      .title,
    "Remote changed again",
  );
  assert.equal(data.rdxImports[key]?.review, undefined);
  // A concurrent local change cannot be overwritten by the prepared result.
  t.mock.method(
    workspaceStore,
    "change",
    async (
      update: (data: import("../../src/domain/types").WorkspaceData) => void,
    ) => {
      data.remote[0]!.summary = "Concurrent local change";
      update(data);
    },
  );
  const retained = data.rdxFiles.length;
  await assert.rejects(session.review({ key }, fields), /workspace changed/);
  assert.equal(data.rdxFiles.length, retained);
  t.mock.method(fields, "refresh", async () => {
    session.cancel();
  });
  await assert.rejects(session.review({ key }, fields), /review was closed/);
  t.mock.method(fields, "refresh", async () => {
    setAuthSession(null);
  });
  await assert.rejects(
    session.review({ key }, fields),
    /session|sign|account/i,
  );
  assert.equal(data.rdxFiles.length, retained);
});
