import assert from "node:assert/strict";
import test from "node:test";
import { stageFileBatch } from "../../src/attachments/stage-batch";
import type { UploadStore } from "../../src/attachments/types";
void test("multi-file staging stores and durably queues each file once, retaining the completed prefix on quota failure", async () => {
  const calls: string[] = [],
    queued: string[] = [];
  const files = [new File(["one"], "one.txt"), new File(["two"], "two.txt")];
  const storage: UploadStore = {
    get: () => {
      return Promise.resolve(undefined);
    },
    remove: () => {
      throw Error("Must not remove uncertain stored bytes");
    },
    put: (value) => {
      calls.push(value.file.name);
      if (value.file.name === "two.txt") return Promise.reject(Error("Quota"));
      return Promise.resolve();
    },
  };
  await assert.rejects(
    stageFileBatch(files, storage, (upload) => {
      queued.push(upload.file.name);
      return Promise.resolve();
    }),
    /1 of 2 files confirmed staged/,
  );
  assert.deepEqual(calls, ["one.txt", "two.txt"]);
  assert.deepEqual(queued, ["one.txt"]);
});
void test("invalid batch entries prevent every storage and queue write", async () => {
  const storage: UploadStore = {
    get: () => {
      return Promise.resolve(undefined);
    },
    remove: () => {
      throw Error("Unexpected removal");
    },
    put: () => {
      throw Error("Must validate before storing");
    },
  };
  await assert.rejects(
    stageFileBatch(
      [new File(["one"], "one.txt"), new File(["bad"], "../bad.txt")],
      storage,
      () => {
        return Promise.reject(Error("Must not queue"));
      },
    ),
    /filename/,
  );
});
