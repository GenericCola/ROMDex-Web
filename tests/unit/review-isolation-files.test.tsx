import assert from "node:assert/strict";
import test from "node:test";
import { cloudData } from "../../src/cloud/types";
import type { TaskOperation } from "../../src/domain/types";
import { YouTrackHttpError } from "../../src/youtrack/http-error";
import { A, B, fixture } from "../fixtures/review-isolation";
for (const mode of ["missing", "changed"]) {
  void test(`known pre-dispatch attachment ${mode} isolates ticket and preserves independent delivery`, async () => {
    const f = await fixture();
    const upload = f.independent("file");
    assert.equal(upload.type, "attachment");
    if (upload.type !== "attachment") throw Error("fixture");
    const bad: TaskOperation =
      mode === "missing"
        ? { ...upload, issueId: A }
        : {
            type: "attachment-delete",
            issueId: A,
            opId: "safe",
            attachmentId: "old-file",
            base: {
              id: "old-file",
              name: "original.txt",
              size: 4,
              mimeType: "text/plain",
              created: 1,
              updated: 1,
              authorId: "synthetic-owner",
            },
          };
    const unrelated = f.edit(B, "independent");
    await f.store.change((data) => {
      data.operations = [bad, unrelated];
    });
    if (mode === "missing") f.remote.delete(A);
    if (bad.type === "attachment-delete")
      f.port.files!.list = () => {
        return Promise.resolve([{ ...bad.base, updated: 2 }]);
      };
    await f.run();
    assert.deepEqual(f.sent(), ["scalar:" + B]);
    assert.deepEqual(f.state().operations, [bad]);
    assert.equal(cloudData(f.state()).records.safe?.status, "conflict");
    assert.equal(cloudData(f.state()).records.independent?.status, "confirmed");
    assert.equal(
      f.uploads.size,
      1,
      "retained original upload bytes are not discarded",
    );
    await f.run();
    assert.deepEqual(f.sent(), ["scalar:" + B]);
  });
}
void test("attachment post-dispatch response loss is uncertain and aborts this batch", async () => {
  const f = await fixture(),
    bad = f.independent("file"),
    unrelated = f.edit(A, "independent");
  await f.store.change((data) => {
    data.operations = [bad, unrelated];
  });
  let attempts = 0;
  f.port.files!.upload = () => {
    attempts++;
    return Promise.reject(Error("Response lost after file upload"));
  };
  assert.ok(await f.run());
  assert.equal(attempts, 1);
  assert.deepEqual(f.state().operations, [bad, unrelated]);
  assert.equal(cloudData(f.state()).records.safe?.status, "uncertain");
  assert.equal(cloudData(f.state()).records.independent, undefined);
  assert.equal(f.uploads.size, 1);
  await f.run();
  assert.equal(attempts, 1, "uncertain upload cannot be resent");
});

const assertTransportFailure = async (mode: string) => {
  const f = await fixture(),
    bad = f.edit(A, "bad"),
    safe = f.independent("scalar");
  await f.store.change((data) => {
    data.operations = [bad, safe];
  });
  const { get } = f.port;
  f.port.get = async (id) => {
    if (id === A)
      throw mode === "network"
        ? Error("Network unavailable")
        : new YouTrackHttpError(Number(mode));
    return get(id);
  };
  assert.ok(await f.run());
  assert.deepEqual(f.sent(), []);
  assert.deepEqual(f.store.getSnapshot().data.operations, [bad, safe]);
  assert.equal(cloudData(f.store.getSnapshot().data).records.bad, undefined);
};

for (const mode of ["401", "403", "network"])
  void test(`${mode} before dispatch is global fail-closed, never classified as missing`, async () => {
    await assertTransportFailure(mode);
  });
