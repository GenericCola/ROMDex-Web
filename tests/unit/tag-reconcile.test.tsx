import assert from "node:assert/strict";
import test from "node:test";
import { rebaseEdit } from "../../src/cloud/rebase-edit";
import { tagReconcileValues } from "../../src/cloud/tag-reconcile";
import { reconcile } from "../../src/domain/accepted/core.mjs";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { normalize } from "../../src/youtrack/read-tasks";
import { rawIssue } from "../fixtures/native-field-delivery";
void test("tag reconciliation compares sets and refuses an absent baseline", () => {
  const base = { ...normalize(rawIssue()), tags: ["b", "a"] };
  const values = tagReconcileValues(
    base,
    { tags: ["a", "b"] },
    { ...base, tags: ["a", "b"] },
  );
  assert.deepEqual(reconcile(values.base, values.patch, values.remote), {
    patch: {},
    conflicts: [],
  });
  assert.deepEqual(base.tags, ["b", "a"]);
  const missing = { ...base };
  delete (missing as { tags?: string[] }).tags;
  assert.throws(
    () => tagReconcileValues(missing, { tags: [] }, base),
    /Invalid tag/,
  );
});
void test("explicit tag rebase archives uncertain evidence and retains pending plan followup", () => {
  const data = emptyWorkspace(),
    base = { ...normalize(rawIssue()), tags: ["a"] };
  data.operations = [
    {
      type: "edit",
      opId: "tag-edit",
      issueId: base.id,
      base,
      patch: { tags: ["b"] },
    },
  ];
  const steps = [
    {
      tagId: "a",
      action: "remove" as const,
      before: ["a"],
      after: [],
      status: "attempting" as const,
    },
  ];
  data.cloud = {
    autoSync: false,
    accountId: "fixture",
    records: {
      "tag-edit": {
        status: "uncertain",
        message: "Interrupted",
        tagSteps: steps,
      },
    },
  };
  data.rdxImports = {
    plan: {
      tasks: {},
      batches: {
        batch: {
          id: "batch",
          revision: "r1",
          taskIds: [],
          opIds: ["tag-edit"],
          completed: [],
          status: "pending",
          entries: [{ opId: "tag-edit", type: "edit", issueId: base.id }],
        },
      },
    },
  };
  rebaseEdit(data, "tag-edit", { ...base, tags: [] });
  assert.deepEqual(data.cloud.records["tag-edit"]?.tagSteps, steps);
  assert.equal(
    data.cloud.records["tag-edit"]?.archivedOperation?.opId,
    "tag-edit",
  );
  const next = data.operations[0]!;
  assert.notEqual(next.opId, "tag-edit");
  assert.equal(data.rdxImports.plan?.batches.batch?.status, "pending");
  assert.deepEqual(data.rdxImports.plan?.batches.batch?.opIds, [
    "tag-edit",
    next.opId,
  ]);
});

void test("tag journal cannot detach its first step from the reviewed baseline or desired membership", async () => {
  const { validateTagJournal } = await import("../../src/cloud/tag-journal");
  const base = { ...normalize(rawIssue()), tags: ["a"] };
  const operation = {
    type: "edit" as const,
    opId: "op",
    issueId: base.id,
    base,
    patch: { tags: ["b"] },
  };
  const record = {
    status: "uncertain" as const,
    message: "Interrupted",
    tagSteps: [
      {
        tagId: "a",
        action: "remove" as const,
        before: ["a"],
        after: [],
        status: "attempting" as const,
      },
    ],
  };
  assert.doesNotThrow(() => validateTagJournal(record, operation));
  assert.throws(
    () =>
      validateTagJournal(
        {
          ...record,
          tagSteps: [
            { ...record.tagSteps[0]!, before: ["a", "c"], after: ["c"] },
          ],
        },
        operation,
      ),
    /evidence/,
  );
  assert.throws(
    () =>
      validateTagJournal(
        {
          ...record,
          tagSteps: [
            {
              tagId: "c",
              action: "add",
              before: ["a"],
              after: ["a", "c"],
              status: "attempting",
            },
          ],
        },
        operation,
      ),
    /evidence/,
  );
});
