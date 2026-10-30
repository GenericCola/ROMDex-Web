import assert from "node:assert/strict";
import { editTask } from "../../src/domain/task-actions";
import type { TaskItem, WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { WorkspaceStore } from "../../src/domain/workspace-store";
const item = (id: string, parentId: string | null): TaskItem => {
  return {
    id,
    parentId,
    summary: "Synthetic",
    description: "",
    state: "To do",
    assignedState: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 1,
    comments: [],
    commentCount: 0,
  };
};
export const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};
export const setup = async () => {
  let saved = emptyWorkspace(),
    revision = 0;
  saved.remote = [
    item("PMON-900000", null),
    item("PMON-900001", "PMON-900000"),
    item("PMON-900002", "PMON-900000"),
  ];
  const persistence = {
    load: () => {
      return Promise.resolve({ data: structuredClone(saved), revision });
    },
    save: (data: WorkspaceData, expected: number) => {
      assert.equal(expected, revision);
      saved = structuredClone(data);
      return Promise.resolve(++revision);
    },
  };
  const store = new WorkspaceStore(persistence);
  await store.start();
  await store.change((data) => {
    editTask(data, "PMON-900001", { priority: "High" });
  });
  return {
    store,
    saved: () => {
      return saved;
    },
  };
};
