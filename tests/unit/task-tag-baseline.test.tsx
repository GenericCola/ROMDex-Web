import assert from "node:assert/strict";
import test from "node:test";
import { reviewedItemEdit } from "../../src/domain/reviewed-item-edit";
import { applyTaskTagBaseline } from "../../src/domain/task-tag-baseline";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { normalize } from "../../src/youtrack/read-tasks";
import { rawIssue } from "../fixtures/native-field-delivery";
const fixture = () => {
  const data = emptyWorkspace();
  data.remote = [
    {
      ...normalize(rawIssue()),
      tags: ["a"],
      tagNames: [{ id: "a", name: "Old tag" }],
    },
  ];
  return data;
};
void test("fresh full tag inventory preserves pending edit and its original baseline", () => {
  const data = fixture(),
    base = structuredClone(data.remote[0]!);
  data.operations = [
    {
      type: "edit",
      opId: "edit",
      issueId: base.id,
      base,
      patch: { tags: ["b"] },
    },
  ];
  applyTaskTagBaseline(
    data,
    base.id,
    ["c", "a"],
    [{ id: "c", name: "New tag" }],
  );
  assert.deepEqual(data.remote[0]?.tags, ["a", "c"]);
  assert.deepEqual(base.tags, ["a"]);
  assert.deepEqual(data.remote[0]?.tagNames, [
    { id: "a", name: "Old tag" },
    { id: "c", name: "New tag" },
  ]);
  assert.deepEqual(
    data.operations[0]?.type === "edit" ? data.operations[0].patch.tags : null,
    ["b"],
  );
});
void test("reviewed tag edits require current baseline and existing available additions", () => {
  const data = fixture(),
    id = data.remote[0]!.id;
  const options = {
    tags: { ready: true, options: [{ id: "b", name: "New" }] },
  };
  assert.throws(
    () => reviewedItemEdit(data, id, { tags: ["x"] }, { tags: ["a"] }, options),
    /existing available/,
  );
  assert.throws(
    () => reviewedItemEdit(data, id, { tags: ["b"] }, {}, options),
    /Invalid tag/,
  );
  assert.throws(
    () =>
      reviewedItemEdit(
        data,
        id,
        { tags: ["b"] },
        { tags: ["a"] },
        { tags: { ready: false, options: [] } },
      ),
    /unavailable/,
  );
  reviewedItemEdit(data, id, { tags: ["a", "b"] }, { tags: ["a"] }, options);
  assert.deepEqual(
    data.operations[0]?.type === "edit" ? data.operations[0].patch.tags : null,
    ["a", "b"],
  );
});

void test("first tag edit coalesced with another field uses its freshly reviewed tag baseline only", () => {
  const data = fixture(),
    base = structuredClone(data.remote[0]!);
  delete base.tags;
  data.operations = [
    {
      type: "edit",
      opId: "summary-edit",
      issueId: base.id,
      base,
      patch: { summary: "Pending title" },
    },
  ];
  reviewedItemEdit(
    data,
    base.id,
    { tags: ["b"] },
    { tags: ["a"] },
    { tags: { ready: true, options: [{ id: "b", name: "New" }] } },
  );
  const op = data.operations[0];
  if (op?.type !== "edit") throw Error("Missing edit");
  assert.deepEqual(op.base.tags, ["a"]);
  assert.equal(op.base.summary, base.summary);
  assert.equal(op.patch.summary, "Pending title");
});
