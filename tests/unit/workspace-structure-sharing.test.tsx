import assert from "node:assert/strict";
import test from "node:test";
import { shareStructure } from "../../src/domain/share-structure";
import type { TaskItem, WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
const task = (id: string): TaskItem => {
  return {
    id,
    summary: "Task " + id,
    description: "",
    parentId: null,
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 1,
    comments: [],
    commentCount: 0,
  };
};
const openStore = async () => {
  const store = new WorkspaceStore({
    load: async () => {
      const data = emptyWorkspace();
      data.remote = [task("PMON-1"), task("PMON-2")];
      return { revision: 0, data };
    },
    save: async (_data: WorkspaceData, revision: number) => {
      return revision + 1;
    },
  });
  await store.start();
  return store;
};
void test("unchanged workspace parts keep their identity across writes", async () => {
  const store = await openStore();
  const before = store.getSnapshot().data;
  await store.change((data) => {
    data.view.search = "map";
  });
  const after = store.getSnapshot().data;
  assert.notEqual(after, before);
  assert.notEqual(after.view, before.view);
  assert.equal(after.remote, before.remote);
  assert.equal(after.operations, before.operations);
  assert.equal(after.order, before.order);
  assert.equal(after.view.expanded, before.view.expanded);
  assert.equal(after.view.search, "map");
});
void test("shareStructure keeps changed values and plain-data semantics", () => {
  const previous = { a: [1, { b: 2 }], c: { d: "x" }, e: 1 };
  const next = { a: [1, { b: 2 }], c: { d: "y" }, e: 1 };
  const shared = shareStructure(previous, next);
  assert.deepEqual(shared, next);
  assert.equal(shared.a, previous.a);
  assert.notEqual(shared.c, previous.c);
  assert.equal(shareStructure(previous, structuredClone(previous)), previous);
  const reordered = shareStructure({ x: 1, y: 2 }, { y: 2, x: 1 });
  assert.deepEqual(Object.keys(reordered), ["y", "x"]);
  const missing = shareStructure({ x: 1, y: undefined }, { x: 1 });
  assert.deepEqual(Object.keys(missing), ["x"]);
  const proto = shareStructure(
    {},
    JSON.parse('{"__proto__":{"z":1}}') as object,
  );
  assert.equal(Object.getPrototypeOf(proto), Object.prototype);
  assert.deepEqual(Object.keys(proto), ["__proto__"]);
});
