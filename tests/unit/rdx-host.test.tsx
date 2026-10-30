import assert from "node:assert/strict";
import test from "node:test";
import { base64Bytes, encodeBytes } from "../../src/domain/bytes";
import { jsonObject } from "../../src/domain/json";
import type { WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
import { readRdx, writeRdx } from "../../src/rdx/container";
import { BrowserPlanHost } from "../../src/rdx/plan-host";
import { PlanTransfer } from "../../src/rdx/plan-transfer";
import { planDocument } from "../fixtures/rdx";
void test("original desktop dialog routes import, edit and export locally without queueing", async () => {
  let data = emptyWorkspace(),
    revision = 0;
  await workspaceStore.switchPersistence({
    load: () => {
      return Promise.resolve({ data, revision });
    },
    save: (next: WorkspaceData, expected: number) => {
      assert.equal(expected, revision);
      data = structuredClone(next);
      return Promise.resolve(++revision);
    },
  });
  const host = new BrowserPlanHost();
  const bytes = await writeRdx(planDocument(), new Map());
  const upload = (await host.api("begin", { bytes: bytes.length })) as {
    id: string;
  };
  await host.api("chunk", {
    id: upload.id,
    offset: 0,
    base64: encodeBytes(bytes),
  });
  const preview = (await host.api("preview", { id: upload.id })) as {
    token: string;
  };
  const imported = (await host.api("import", {
    id: upload.id,
    token: preview.token,
    approved: true,
  })) as { key: string };
  assert.equal(data.operations.length, 0);
  assert.equal(data.rdxFiles?.length, 1);
  const view = (await host.api("view", { key: imported.key })) as {
    document: ReturnType<typeof planDocument>;
  };
  await host.api("edit", {
    key: imported.key,
    taskId: "task:fixture",
    expectedRevision: view.document.revision!,
    patch: { title: "Edited synthetic plan" },
  });
  assert.equal(data.rdxFiles?.length, 2);
  assert.equal(data.operations.length, 0);
  const exported = (await host.api("export", { key: imported.key })) as {
    id: string;
  };
  const chunk = (await host.api("export-chunk", {
    key: imported.key,
    id: exported.id,
    offset: 0,
  })) as { base64: string };
  const decoded = await readRdx(base64Bytes(chunk.base64));
  const task = jsonObject(
    (jsonObject(decoded.document.content).tasks as never[])[0],
  );
  assert.equal(task.title, "Edited synthetic plan");
  await assert.rejects(
    host.api("publication-preview", { key: imported.key }),
    /Sign in with YouTrack/,
  );
  await assert.rejects(
    host.api("queue", { key: imported.key, approved: true }),
    /approval is required/,
  );
  assert.equal(data.operations.length, 0);
});
void test("chunk transfer rejects wrong identity, offset, incomplete bytes and oversize allocations", () => {
  const transfer = new PlanTransfer();
  assert.throws(() => {
    transfer.begin(65 * 1024 * 1024);
  });
  const upload = transfer.begin(2);
  assert.throws(() => {
    transfer.chunk(upload.id, 1, "AA==");
  });
  assert.throws(() => {
    transfer.read(upload.id);
  });
  transfer.chunk(upload.id, 0, "AAA=");
  assert.deepEqual(transfer.read(upload.id), new Uint8Array(2));
  transfer.cancel();
  assert.throws(() => {
    transfer.read(upload.id);
  });
});
