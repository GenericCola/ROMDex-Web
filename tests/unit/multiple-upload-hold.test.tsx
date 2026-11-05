import assert from "node:assert/strict";
import test from "node:test";
import { cancelUnsentUpload, queueUpload } from "../../src/attachments/actions";
import { cloudData } from "../../src/cloud/types";
import { fixture } from "../fixtures/review-isolation";
void test("repeated same-file additions survive an uncertain upload, stay unsent, and cancel independently", async () => {
  const f = await fixture(),
    first = f.independent("file");
  if (first.type !== "attachment") throw Error("fixture");
  await f.store.change((data) => {
    data.operations = [first];
    cloudData(data).records[first.opId] = {
      status: "uncertain",
      message: "receipt pending",
      attachmentBeforeIds: [],
    };
  });
  const evidence = structuredClone(cloudData(f.state()).records.safe);
  await f.store.change((data) =>
    queueUpload(data, first.issueId, "second", first.file),
  );
  await f.store.change((data) =>
    queueUpload(data, first.issueId, "third", first.file),
  );
  await f.store.flush();
  assert.deepEqual(
    f.state().operations.map((op) => op.opId),
    ["safe", "second", "third"],
  );
  await f.run(true);
  assert.deepEqual(f.sent(), []);
  assert.deepEqual(cloudData(f.state()).records.safe, evidence);
  await f.store.change((data) => cancelUnsentUpload(data, "second"));
  assert.deepEqual(
    f.state().operations.map((op) => op.opId),
    ["safe", "third"],
  );
  assert.deepEqual(cloudData(f.state()).records.safe, evidence);
  assert.throws(
    () => cancelUnsentUpload(f.state(), "safe"),
    /delivery evidence/,
  );
  await assert.rejects(
    async () =>
      f.store.change((data) => {
        data.operations[0] = {
          ...first,
          file: { ...first.file, name: "replaced.txt" },
        };
      }),
    /synchronized or need review/,
  );
});
