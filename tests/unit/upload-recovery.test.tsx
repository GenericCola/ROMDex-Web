import assert from "node:assert/strict";
import test from "node:test";
import type { Attachment } from "../../src/attachments/types";
import {
  reconcileUploads,
  uploadReadbackDue,
} from "../../src/cloud/reconcile-uploads";
import { reviewAttachment } from "../../src/cloud/review-attachment";
import { cloudData } from "../../src/cloud/types";
import { A, fixture } from "../fixtures/review-isolation";

const setup = async (receipt = true) => {
  const f = await fixture();
  const op = f.independent("file");
  if (op.type !== "attachment" || !f.port.files) throw Error("fixture");
  const file: Attachment = {
    id: "receipt-1",
    name: op.file.name,
    size: op.file.size,
    mimeType: op.file.mimeType,
    authorId: f.port.accountId,
    created: 1,
    updated: 1,
  };
  await f.store.change((data) => {
    data.operations = [op];
    cloudData(data).records[op.opId] = {
      status: "uncertain",
      message: "lost response",
      targetId: op.issueId,
      attachmentBeforeIds: [],
      ...(receipt ? { remoteId: file.id } : {}),
    };
  });
  let inventory = [file],
    reads = 0,
    downloads = 0;
  f.port.files.list = async () => {
    reads++;
    return structuredClone(inventory);
  };
  const download = f.port.files.download;
  f.port.files.download = async (...args) => {
    downloads++;
    return download(...args);
  };
  f.port.files.upload = async () => {
    throw Error("Recovery must never upload");
  };
  f.port.files.remove = async () => {
    throw Error("Recovery must never delete");
  };
  const run = (now = 0) =>
    f.store.deliver((commit) =>
      reconcileUploads(f.state, commit, f.port, f.storage, now),
    );
  return {
    ...f,
    op,
    file,
    run,
    inventory: (files: Attachment[]) => {
      inventory = files;
    },
    reads: () => reads,
    downloads: () => downloads,
  };
};
for (const receipt of [true, false])
  void test(`automatic readback verifies ${receipt ? "stored receipt" : "unique candidate"} once and preserves durable evidence`, async () => {
    const f = await setup(receipt);
    await f.run();
    assert.equal(f.state().operations.length, 0);
    assert.equal(cloudData(f.state()).records.safe?.remoteId, f.file.id);
    assert.equal(cloudData(f.state()).records.safe?.status, "confirmed");
    assert.equal(f.uploads.size, 0);
    assert.equal(f.downloads(), 1);
    await f.run(120_000);
    assert.equal(f.downloads(), 1);
  });
for (const mode of [
  "zero",
  "multiple",
  "baseline",
  "name",
  "size",
  "author",
  "hash",
  "denied",
  "account",
  "claimed",
  "overlap",
])
  void test(`automatic upload readback retains bytes and evidence for ${mode}`, async () => {
    const f = await setup(!["zero", "multiple", "overlap"].includes(mode));
    const before = structuredClone(f.state().operations);
    if (mode === "zero") f.inventory([]);
    if (mode === "multiple")
      f.inventory([f.file, { ...f.file, id: "receipt-2" }]);
    if (mode === "name") f.inventory([{ ...f.file, name: "different.txt" }]);
    if (mode === "size") f.inventory([{ ...f.file, size: 999 }]);
    if (mode === "author")
      f.inventory([{ ...f.file, authorId: "someone-else" }]);
    if (mode === "hash")
      f.port.files!.download = async () => new Uint8Array([0]);
    if (mode === "denied")
      f.port.files!.list = async () => {
        throw Error("403");
      };
    if (mode === "account") f.port.accountId = "other-account";
    await f.store.deliver(async (commit) =>
      commit((data) => {
        if (mode === "baseline")
          delete cloudData(data).records.safe!.attachmentBeforeIds;
        if (mode === "claimed")
          cloudData(data).records.old = {
            status: "confirmed",
            message: "already used",
            remoteId: f.file.id,
            targetId: f.op.issueId,
            archivedOperation: { ...f.op, opId: "old", uploadId: "old" },
          };
        if (mode === "overlap") {
          data.operations.push({ ...f.op, opId: "second", uploadId: "second" });
          cloudData(data).records.second = {
            status: "uncertain",
            message: "another lost response",
            attachmentBeforeIds: [],
            targetId: f.op.issueId,
          };
        }
      }),
    );
    await f.run();
    assert.deepEqual(f.state().operations.slice(0, 1), before);
    assert.equal(cloudData(f.state()).records.safe?.status, "uncertain");
    assert.equal(f.uploads.size, 1);
    if (mode === "multiple" || mode === "overlap")
      assert.equal(f.downloads(), 0);
  });
void test("readback is bounded per operation, retries after a minute, and a new session can check", async () => {
  const f = await setup(false);
  f.inventory([]);
  await f.run(0);
  await f.run(100);
  await f.run(59_999);
  assert.equal(f.reads(), 1);
  assert.equal(uploadReadbackDue(f.state(), f.port, 59_999), false);
  assert.equal(uploadReadbackDue(f.state(), { ...f.port }, 100), true);
  f.inventory([f.file]);
  await f.run(60_000);
  assert.equal(f.state().operations.length, 0);
});
void test("failed durable acknowledgement keeps bytes and surfaces a global storage error", async () => {
  const f = await setup();
  await assert.rejects(
    reconcileUploads(
      f.state,
      async () => {
        throw Error("disk failure");
      },
      f.port,
      f.storage,
      0,
    ),
    /disk failure/,
  );
  assert.equal(f.uploads.size, 1);
  assert.equal(cloudData(f.state()).records.safe?.status, "uncertain");
});
void test("explicit review cannot reuse another upload's receipt", async () => {
  const f = await setup();
  await f.store.deliver(async (commit) =>
    commit((data) => {
      cloudData(data).records.old = {
        status: "confirmed",
        message: "already confirmed",
        remoteId: f.file.id,
        archivedOperation: { ...f.op, opId: "old", uploadId: "old" },
      };
    }),
  );
  await assert.rejects(
    f.store.deliver((commit) =>
      reviewAttachment(
        f.state(),
        f.op,
        "confirm",
        commit,
        f.port,
        f.file.id,
        false,
        f.storage,
      ),
    ),
    /already belongs/,
  );
  assert.equal(f.uploads.size, 1);
  assert.equal(cloudData(f.state()).records.safe?.status, "uncertain");
});
void test("fresh accepted upload with lost response recovers without replay and continues another ticket", async () => {
  const f = await fixture();
  const op = f.independent("file");
  await f.store.change((data) => {
    data.operations = [op, f.edit(A, "other")];
  });
  const upload = f.port.files!.upload;
  let posts = 0;
  f.port.files!.upload = async (...args) => {
    posts++;
    await upload(...args);
    throw Error("lost response");
  };
  assert.equal(await f.run(), undefined);
  assert.equal(posts, 1);
  assert.equal(f.state().operations.length, 0);
  assert.equal(f.uploads.size, 0);
});
