import assert from "node:assert/strict";
import { test } from "node:test";
import { completeCreation } from "../../src/cloud/creation";
import { indexTree, materialize } from "../../src/domain/accepted/core.mjs";
import { createTask } from "../../src/domain/task-actions";
import {
  beginInlineTask,
  commitInlineTask,
  indentInlineTask,
} from "../../src/domain/task-inline";
import {
  beginInlineRename,
  commitInlineRename,
  indentInlineRename,
} from "../../src/domain/task-rename";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
void test("inline Enter creates one ordered sibling and retains next blank durable row", () => {
  const data = emptyWorkspace(),
    a = createTask(data, null, "A"),
    b = createTask(data, null, "B");
  data.order[a] = 0;
  beginInlineTask(data, null, a);
  assert.ok(data.newTask);
  data.newTask.title = "Inserted";
  commitInlineTask(data);
  assert.equal(data.newTask.title, "");
  const tree = indexTree(materialize(data.remote, data.operations), data.order);
  assert.deepEqual(
    tree.children.get(null)?.map((item) => {
      return item.summary;
    }),
    ["A", "Inserted", "B"],
  );
  assert.equal(data.newTask.afterId, tree.children.get(null)?.[1]?.id);
  assert.ok(b);
  assert.equal(validateWorkspace(structuredClone(data)).newTask?.title, "");
  const count = data.operations.length;
  commitInlineTask(data);
  assert.equal(data.newTask, null);
  assert.equal(data.operations.length, count);
});
void test("draft Tab nests under preceding sibling and ShiftTab restores level, without queuing", () => {
  const data = emptyWorkspace(),
    a = createTask(data, null, "A");
  data.order[a] = 0;
  beginInlineTask(data, null, a);
  assert.ok(data.newTask);
  data.newTask.title = "Keep text";
  const before = JSON.stringify(data.operations);
  indentInlineTask(data, false);
  assert.equal(data.newTask.parentId, a);
  assert.equal(data.newTask.title, "Keep text");
  indentInlineTask(data, true);
  assert.equal(data.newTask.parentId, null);
  assert.equal(data.newTask.afterId, a);
  assert.equal(JSON.stringify(data.operations), before);
  assert.throws(() => {
    return beginInlineTask(data, null);
  }, /Finish or cancel/);
});
void test("rename Enter updates the original title then opens next sibling; empty title is retained", () => {
  const data = emptyWorkspace(),
    a = createTask(data, null, "[Epic] A");
  beginInlineRename(data, a);
  assert.equal(data.titleDrafts[a], "[Epic] A");
  data.titleDrafts[a] = "";
  assert.throws(() => {
    return commitInlineRename(data, a);
  }, /require a title/);
  assert.equal(data.view.renameId, a);
  data.titleDrafts[a] = "Renamed";
  commitInlineRename(data, a);
  assert.equal(
    materialize(data.remote, data.operations)[0]?.summary,
    "Renamed",
  );
  assert.equal(data.view.renameId, null);
  assert.equal(data.newTask?.afterId, a);
  assert.equal(data.titleDrafts[a], undefined);
});
void test("rename nesting uses previous sibling and preserves typed text", () => {
  const data = emptyWorkspace(),
    a = createTask(data, null, "A"),
    b = createTask(data, null, "B");
  data.order[a] = 0;
  data.order[b] = 1;
  beginInlineRename(data, b);
  data.titleDrafts[b] = "B changed";
  indentInlineRename(data, b, false);
  assert.equal(
    materialize(data.remote, data.operations).find((item) => {
      return item.id === b;
    })?.parentId,
    a,
  );
  assert.equal(data.titleDrafts[b], "B changed");
  indentInlineRename(data, b, true);
  assert.equal(
    materialize(data.remote, data.operations).find((item) => {
      return item.id === b;
    })?.parentId,
    null,
  );
});

void test("confirmed creation remaps durable inline editor and insertion anchor", () => {
  const data = emptyWorkspace(),
    id = createTask(data, null, "Pending");
  const operation = data.operations[0];
  assert.ok(operation?.type === "create");
  data.newTask = { title: "Keep draft", parentId: id, afterId: id };
  data.view.renameId = id;
  data.titleDrafts[id] = "Keep rename";
  completeCreation(data, operation, { ...operation.item, id: "PMON-999999" });
  assert.equal(data.view.renameId, "PMON-999999");
  assert.equal(data.newTask.afterId, "PMON-999999");
  assert.equal(data.newTask.parentId, "PMON-999999");
  assert.equal(data.titleDrafts["PMON-999999"], "Keep rename");
});
