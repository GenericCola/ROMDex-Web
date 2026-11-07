import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { OperationReviewRequired } from "../../src/cloud/review-isolation";
import { validateWorkspace } from "../../src/domain/workspace-data";
import { localUploadFixture } from "./local-upload-fixture";

test("missing local bytes isolate upload in either queue order; independent edits confirm and marker survives reopen", async () => {
  for (const uploadFirst of [true, false]) {
    const s = await localUploadFixture(uploadFirst),
      original = structuredClone(
        s.data().operations.find((op) => op.type === "attachment"),
      );
    await assert.rejects(s.run(), OperationReviewRequired);
    assert.equal(s.uploads(), 0);
    assert.equal(s.updates(), 1);
    assert.deepEqual(s.data().operations, [original]);
    const record = s.data().cloud!.records[s.value.id]!;
    assert.equal(record.status, "conflict");
    assert.equal(record.localFileState, "missing");
    assert.equal(record.attachmentBeforeIds, undefined);
    assert.equal(record.remoteId, undefined);
    s.reopen();
    assert.deepEqual(s.data().cloud!.records[s.value.id], record);
    assert.equal(s.data().commentDrafts.keep, "Preserve unrelated draft");
    assert.equal(automaticBatch(s.data())?.size, 0);
  }
});

test("local-file markers reject malformed state, non-upload intent, and dispatch evidence", async () => {
  const s = await localUploadFixture();
  await assert.rejects(s.run(), OperationReviewRequired);
  const baseline = structuredClone(s.data());
  for (const patch of [
    { localFileState: "other" },
    { status: "attempting" },
    { status: "uncertain" },
    { status: "ready", localFileState: "missing" },
    { status: "conflict", localFileState: "restored" },
    { remoteId: "134-1" },
    { attachmentBeforeIds: [] },
    { targetId: "PMON-900101" },
    { archivedOperation: baseline.operations[0] },
    { tagSteps: [] },
  ]) {
    const bad = structuredClone(baseline);
    Object.assign(bad.cloud!.records[s.value.id]!, patch);
    assert.throws(() => validateWorkspace(bad), JSON.stringify(patch));
  }
  const bad = structuredClone(baseline);
  const upload = bad.operations[0]!;
  bad.operations[0] = {
    opId: upload.opId,
    type: "comment",
    issueId: upload.issueId,
    text: "Keep this comment",
    created: 1,
  };
  assert.throws(() => validateWorkspace(bad));
});

test("explicit cancellation archives only unsent upload and preserves independent drafts without remote writes", async () => {
  const { reviewQueue } = await import("../../src/cloud/review");
  const s = await localUploadFixture();
  await assert.rejects(s.run(), OperationReviewRequired);
  const original = structuredClone(s.data().operations[0]);
  await reviewQueue(
    s.data(),
    s.commit,
    s.port,
    s.value.id,
    "cloud",
    "",
    false,
    s.storage,
  );
  assert.equal(s.data().operations.length, 0);
  const record = s.data().cloud!.records[s.value.id]!;
  assert.equal(record.status, "confirmed");
  assert.equal(record.localFileState, undefined);
  assert.deepEqual(record.archivedOperation, original);
  assert.equal(s.uploads(), 0);
  assert.equal(s.updates(), 1);
  assert.equal(s.data().commentDrafts.keep, "Preserve unrelated draft");
  s.reopen();
});

test("uncertain dispatched upload is never relabeled as a local missing file or resent", async () => {
  const s = await localUploadFixture();
  await s.commit((data) => {
    data.cloud!.records[s.value.id] = {
      status: "uncertain",
      message: "Upload response lost",
      targetId: "PMON-900101",
      attachmentBeforeIds: [],
      remoteId: "134-lost",
    };
  });
  const original = structuredClone(s.data().cloud!.records[s.value.id]);
  await assert.rejects(s.run(), OperationReviewRequired);
  assert.deepEqual(s.data().cloud!.records[s.value.id], original);
  assert.equal(s.uploads(), 0);
  assert.equal(s.updates(), 1);
  assert.equal(s.data().operations[0]?.type, "attachment");
});

test("restoring exact bytes persists ready state; automatic delivery holds until explicit Save", async () => {
  const { restoreUploadBytes } =
    await import("../../src/attachments/restore-upload");
  const { persistedUploadStore } = await import("./local-upload-fixture");
  const { deliverQueue } = await import("../../src/cloud/delivery");
  const s = await localUploadFixture();
  await assert.rejects(s.run(), OperationReviewRequired);
  const { store, reopen } = await persistedUploadStore(s.data());
  const operation = store.getSnapshot().data.operations[0]!;
  assert.equal(operation.type, "attachment");
  if (operation.type !== "attachment") throw Error("upload expected");
  const before = structuredClone(store.getSnapshot().data);
  await assert.rejects(
    restoreUploadBytes(
      operation,
      new File(["incorrect bytes"], "keep.txt"),
      store,
      s.storage,
    ),
  );
  assert.deepEqual(store.getSnapshot().data, before);
  assert.equal(s.values.size, 0);
  assert.equal(
    await restoreUploadBytes(
      operation,
      new File([await s.value.blob.arrayBuffer()], "renamed.txt"),
      store,
      s.storage,
    ),
    true,
  );
  assert.deepEqual(s.values.get(s.value.id)!.file, s.value.file);
  assert.equal(s.uploads(), 0);
  const reopened = await reopen(),
    current = () => reopened.getSnapshot().data;
  assert.equal(
    current().cloud!.records[s.value.id]!.localFileState,
    "restored",
  );
  assert.equal(current().cloud!.records[s.value.id]!.status, "ready");
  assert.equal(automaticBatch(current())?.size, 0);
  await reopened.deliver(
    (commit) =>
      deliverQueue(
        current,
        commit,
        s.port,
        s.storage,
        () => true,
        automaticBatch(current()),
      ),
    automaticBatch(current()),
  );
  assert.equal(s.uploads(), 0);
  assert.equal(current().operations.length, 1);
  await reopened.deliver((commit) =>
    deliverQueue(current, commit, s.port, s.storage),
  );
  assert.equal(s.uploads(), 1);
  assert.equal(current().operations.length, 0);
  assert.equal(current().cloud!.records[s.value.id]!.localFileState, undefined);
  assert.deepEqual(
    current().cloud!.records[s.value.id]!.archivedOperation,
    operation,
  );
});

test("restoring bytes cannot clear an uncertain receipt or a different review", async () => {
  const { restoreUploadBytes } =
    await import("../../src/attachments/restore-upload");
  const { persistedUploadStore } = await import("./local-upload-fixture");
  const s = await localUploadFixture();
  await s.commit((data) => {
    data.cloud!.records[s.value.id] = {
      status: "uncertain",
      message: "Preserve remote outcome",
      targetId: "PMON-900101",
      attachmentBeforeIds: [],
      remoteId: "134-lost",
    };
  });
  const { store } = await persistedUploadStore(s.data()),
    before = structuredClone(store.getSnapshot().data);
  const operation = before.operations.find((op) => op.type === "attachment")!;
  if (operation.type !== "attachment") throw Error("upload expected");
  assert.equal(
    await restoreUploadBytes(
      operation,
      new File([await s.value.blob.arrayBuffer()], "keep.txt"),
      store,
      s.storage,
    ),
    false,
  );
  assert.deepEqual(store.getSnapshot().data, before);
  assert.equal(s.uploads(), 0);
  assert.equal(s.updates(), 0);
});

test("restore rejects stale workspace and changed upload intent before storing bytes", async () => {
  const { restoreUploadBytes } =
    await import("../../src/attachments/restore-upload");
  const { persistedUploadStore } = await import("./local-upload-fixture");
  for (const change of ["workspace", "operation"]) {
    const s = await localUploadFixture(),
      { store } = await persistedUploadStore(s.data());
    const operation = structuredClone(
      store
        .getSnapshot()
        .data.operations.find((op) => op.type === "attachment")!,
    );
    if (operation.type !== "attachment") throw Error("upload expected");
    const bytes = await s.value.blob.arrayBuffer();
    let release!: (bytes: ArrayBuffer) => void;
    const file = new File([bytes], "keep.txt");
    file.arrayBuffer = () =>
      new Promise((resolve) => {
        release = resolve;
      });
    const restoring = restoreUploadBytes(operation, file, store, s.storage);
    if (change === "workspace") {
      const other = structuredClone(s.data());
      other.cloud!.accountId = "different-owner";
      await store.switchPersistence({
        load: async () => ({ data: other, revision: 0 }),
        save: async () => 1,
      });
    } else {
      await store.change((data) => {
        const op = data.operations.find((op) => op.opId === operation.opId)!;
        if (op.type === "attachment") op.file.name = "changed.txt";
      });
    }
    const unchanged = structuredClone(store.getSnapshot().data);
    release(bytes);
    await assert.rejects(restoring, /workspace or queued file changed/i);
    assert.deepEqual(store.getSnapshot().data, unchanged);
    assert.equal(s.values.size, 0);
    assert.equal(s.uploads(), 0);
  }
});

test("offline local cancellation archives metadata and keeps cached bytes; unknown dispatch states reject", async () => {
  const { cancelLocalUpload } =
    await import("../../src/attachments/restore-upload");
  const { persistedUploadStore } = await import("./local-upload-fixture");
  const s = await localUploadFixture();
  await assert.rejects(s.run(), OperationReviewRequired);
  await s.storage.put(s.value);
  const { store } = await persistedUploadStore(s.data());
  const operation = store.getSnapshot().data.operations[0]!;
  if (operation.type !== "attachment") throw Error("upload expected");
  await cancelLocalUpload(operation, store);
  assert.equal(store.getSnapshot().data.operations.length, 0);
  assert.deepEqual(
    store.getSnapshot().data.cloud!.records[operation.opId]!.archivedOperation,
    operation,
  );
  assert.ok(s.values.has(s.value.id));
  assert.equal(s.uploads(), 0);
  for (const status of [undefined, "attempting", "uncertain"] as const) {
    const next = await localUploadFixture();
    if (status)
      await next.commit((data) => {
        data.cloud!.records[next.value.id] = {
          status,
          message: "Possible dispatched request",
          targetId: "PMON-900101",
          attachmentBeforeIds: [],
        };
      });
    const { store: held } = await persistedUploadStore(next.data()),
      before = structuredClone(held.getSnapshot().data);
    const pending = before.operations.find((op) => op.type === "attachment")!;
    if (pending.type !== "attachment") throw Error("upload expected");
    await assert.rejects(cancelLocalUpload(pending, held));
    assert.deepEqual(held.getSnapshot().data, before);
    assert.equal(next.uploads(), 0);
    assert.equal(next.updates(), 0);
  }
});

test("restored upload whose task becomes unreadable remains isolated in either queue order", async () => {
  const { restoreUploadBytes } =
    await import("../../src/attachments/restore-upload");
  const { persistedUploadStore } = await import("./local-upload-fixture");
  const { deliverQueue } = await import("../../src/cloud/delivery");
  for (const uploadFirst of [true, false]) {
    const s = await localUploadFixture(uploadFirst);
    await s.commit((data) => {
      data.cloud!.records[s.value.id] = {
        status: "conflict",
        localFileState: "missing",
        message: "Original local file is missing; no upload was sent.",
      };
    });
    const { store, reopen } = await persistedUploadStore(s.data());
    const operation = store
      .getSnapshot()
      .data.operations.find((op) => op.type === "attachment")!;
    if (operation.type !== "attachment") throw Error("upload expected");
    assert.equal(
      await restoreUploadBytes(
        operation,
        new File([await s.value.blob.arrayBuffer()], "keep.txt"),
        store,
        s.storage,
      ),
      true,
    );
    assert.equal(
      store.getSnapshot().data.cloud!.records[s.value.id]!.localFileState,
      "restored",
    );
    const originalGet = s.port.get;
    s.port.get = async (id) =>
      id === operation.issueId ? null : originalGet(id);
    await assert.rejects(
      store.deliver((commit) =>
        deliverQueue(() => store.getSnapshot().data, commit, s.port, s.storage),
      ),
      OperationReviewRequired,
    );
    const data = store.getSnapshot().data,
      record = data.cloud!.records[s.value.id]!;
    assert.equal(s.uploads(), 0);
    assert.equal(s.updates(), 1);
    assert.deepEqual(data.operations, [operation]);
    assert.equal(record.status, "conflict");
    assert.equal(record.localFileState, undefined);
    assert.match(record.message, /not readable/i);
    assert.equal(record.remoteId, undefined);
    assert.equal(record.attachmentBeforeIds, undefined);
    assert.deepEqual(s.values.get(s.value.id)!.file, s.value.file);
    assert.equal(
      await s.values.get(s.value.id)!.blob.text(),
      "exact local upload bytes",
    );
    assert.equal(data.commentDrafts.keep, "Preserve unrelated draft");
    const restored = await reopen();
    assert.deepEqual(restored.getSnapshot().data, data);
  }
});
