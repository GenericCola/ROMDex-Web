import assert from "node:assert/strict";
import { queueUpload } from "../../src/attachments/actions";
import type {
  Attachment,
  StoredUpload,
  UploadStore,
} from "../../src/attachments/types";
import { stagedFile, verifyUpload } from "../../src/attachments/validate";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { deliverQueue } from "../../src/cloud/delivery";
import type { Commit, DeliveryPort } from "../../src/cloud/types";
import { editTask } from "../../src/domain/task-actions";
import type { TaskItem } from "../../src/domain/types";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
export const localUploadFixture = async (uploadFirst = true) => {
  const item = (id: string): TaskItem => ({
    id,
    summary: id,
    description: "",
    parentId: null,
    state: "To do",
    priority: "Normal",
    complexity: null,
    type: "Task",
    updated: 1,
    comments: [],
    commentCount: 0,
  });
  const tasks = [item("PMON-900101"), item("PMON-900102")];
  let data = emptyWorkspace();
  data.remote = structuredClone(tasks);
  data.cloud = { autoSync: true, accountId: "fixture-owner", records: {} };
  data.commentDrafts = { keep: "Preserve unrelated draft" };
  const value = await stagedFile(
    "11111111-1111-4111-8111-111111111111",
    new File(["exact local upload bytes"], "keep.txt", { type: "text/plain" }),
  );
  const addUpload = () => queueUpload(data, tasks[0]!.id, value.id, value.file),
    addEdit = () =>
      editTask(data, tasks[1]!.id, { summary: "Independent edit" });
  if (uploadFirst) {
    addUpload();
    addEdit();
  } else {
    addEdit();
    addUpload();
  }
  const values = new Map<string, StoredUpload>();
  const storage: UploadStore = {
    get: async (id) => values.get(id),
    put: async (v) => {
      await verifyUpload(v);
      values.set(v.id, v);
    },
    remove: async (id) => {
      values.delete(id);
    },
  };
  const commit: Commit = async (update) => {
    const next = structuredClone(data);
    update(next);
    validateWorkspace(next);
    data = next;
  };
  let uploads = 0,
    updates = 0;
  const files: Attachment[] = [];
  const port: DeliveryPort & {
    verifyComment: (id: string, receipt: string, text: string) => Promise<void>;
  } = {
    verifyComment: async () => {
      throw Error("unexpected comment verification");
    },
    accountId: "fixture-owner",
    all: async () => structuredClone(tasks),
    get: async (id) => structuredClone(tasks.find((t) => t.id === id) ?? null),
    update: async (id, patch) => {
      updates++;
      Object.assign(
        tasks.find((t) => t.id === id)!,
        patch,
        { updated: 2 },
      );
    },
    comment: async () => {
      throw Error("unexpected comment");
    },
    prepareCreate: async () => undefined,
    create: async () => {
      throw Error("unexpected create");
    },
    remove: async () => {
      throw Error("unexpected delete");
    },
    children: async () => [],
    files: {
      list: async () => structuredClone(files),
      upload: async (_id, v) => {
        uploads++;
        assert.equal(v.file.hash, value.file.hash);
        files.push({
          id: "134-1",
          name: value.file.name,
          size: value.file.size,
          mimeType: value.file.mimeType,
          created: 1,
          updated: 1,
          authorId: "fixture-owner",
        });
        return { id: "134-1" };
      },
      download: async () => new Uint8Array(await value.blob.arrayBuffer()),
      remove: async () => {
        throw Error("unexpected file delete");
      },
    },
  };
  return {
    data: () => data,
    commit,
    port,
    storage,
    values,
    value,
    uploads: () => uploads,
    updates: () => updates,
    reopen: () => {
      data = JSON.parse(JSON.stringify(data));
      validateWorkspace(data);
    },
    run: (automatic = false) =>
      deliverQueue(
        () => data,
        commit,
        port,
        storage,
        () => true,
        automatic ? automaticBatch(data) : undefined,
      ),
  };
};
export const persistedUploadStore = async (
  data: import("../../src/domain/types").WorkspaceData,
) => {
  const { WorkspaceStore } = await import("../../src/domain/workspace-store");
  let saved = structuredClone(data),
    revision = 0;
  const persistence = {
    load: async () => ({ data: structuredClone(saved), revision }),
    save: async (next: typeof data, expected: number) => {
      assert.equal(expected, revision);
      validateWorkspace(next);
      saved = JSON.parse(JSON.stringify(next));
      return ++revision;
    },
  };
  const store = new WorkspaceStore(persistence);
  await store.start();
  return {
    store,
    reopen: async () => {
      const reopened = new WorkspaceStore(persistence);
      await reopened.start();
      return reopened;
    },
  };
};
