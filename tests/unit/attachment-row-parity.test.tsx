import assert from "node:assert/strict";
import test from "node:test";
import { cancelUnsentAttachmentDeletion } from "../../src/attachments/cancel-deletion";
import { fileSize, nativeAttachmentRows } from "../../src/attachments/rows";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const file = {
  id: "4-1",
  name: "fixture.png",
  size: 1024,
  mimeType: "image/png",
  created: 1,
  updated: 1,
  authorId: "1-1",
};
void test("original attachment row has one deletion state and retains missing-file evidence", () => {
  const data = emptyWorkspace();
  data.attachmentLists = { "PMON-1": [file] };
  data.operations = [
    {
      type: "attachment-delete",
      opId: "delete",
      issueId: "PMON-1",
      attachmentId: file.id,
      base: file,
    },
  ];
  let rows = nativeAttachmentRows(data, "PMON-1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "Queued for Deletion");
  data.attachmentLists["PMON-1"] = [];
  data.cloud = {
    autoSync: false,
    records: { delete: { status: "uncertain", message: "Unknown outcome" } },
  };
  rows = nativeAttachmentRows(data, "PMON-1");
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, "Deletion Needs Review");
  assert.equal(rows[0]?.held, true);
  assert.throws(
    () => cancelUnsentAttachmentDeletion(data, "delete"),
    /delivery evidence/,
  );
  assert.equal(data.operations.length, 1);
});
void test("cancelling a never-sent deletion retains native file and archives intent without completing its RDX batch", () => {
  const data = emptyWorkspace();
  data.attachmentLists = { "PMON-1": [file] };
  data.operations = [
    {
      type: "attachment-delete",
      opId: "delete",
      issueId: "PMON-1",
      attachmentId: file.id,
      base: file,
    },
  ];
  data.rdxImports = {
    plan: {
      tasks: {},
      batches: {
        batch: {
          id: "batch",
          revision: "rev",
          taskIds: [],
          opIds: ["delete"],
          completed: [],
          status: "pending",
        },
      },
    },
  };
  cancelUnsentAttachmentDeletion(data, "delete");
  assert.equal(data.operations.length, 0);
  assert.deepEqual(data.attachmentLists["PMON-1"], [file]);
  assert.equal(
    data.cloud?.records.delete?.archivedOperation?.type,
    "attachment-delete",
  );
  assert.equal(data.rdxImports.plan?.batches.batch?.status, "needs-review");
  assert.deepEqual(data.rdxImports.plan?.batches.batch?.completed, []);
  assert.equal(nativeAttachmentRows(data, "PMON-1")[0]?.status, "On YouTrack");
  assert.equal(fileSize(42), "42 B");
  assert.equal(fileSize(1024), "1.0 KB");
  assert.equal(fileSize(1048576), "1.0 MB");
});
