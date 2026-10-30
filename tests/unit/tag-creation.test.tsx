import assert from "node:assert/strict";
import test from "node:test";
import { deliverCreation } from "../../src/cloud/creation";
import { deliverExisting } from "../../src/cloud/existing-delivery";
import type { Commit, DeliveryPort } from "../../src/cloud/types";
import { validateQueue } from "../../src/cloud/validation";
import { createTask } from "../../src/domain/task-actions";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const setup = () => {
  let data = emptyWorkspace();
  createTask(data, null, "Tagged creation");
  const operation = data.operations[0];
  if (operation?.type !== "create") throw Error("Missing create");
  operation.item.tags = ["b"];
  data.cloud = { autoSync: false, accountId: "fixture", records: {} };
  const remote = {
    ...structuredClone(operation.item),
    id: "PMON-77",
    tags: [] as string[],
    updated: 1,
  };
  let creates = 0,
    adds = 0;
  const commit: Commit = async (update) => {
    const next = structuredClone(data);
    update(next);
    validateQueue(next);
    data = next;
  };
  const unexpected = async (): Promise<never> => {
    throw Error("Unexpected mutation");
  };
  const port: DeliveryPort = {
    accountId: "fixture",
    all: async () => [remote],
    get: async () => structuredClone(remote),
    prepareCreate: async () => {},
    create: async () => {
      creates++;
      return { id: remote.id };
    },
    update: unexpected,
    comment: unexpected,
    remove: unexpected,
    children: async () => [],
    tags: {
      prepare: async () => {},
      list: async () => [...remote.tags],
      add: async (_, id) => {
        adds++;
        remote.tags.push(id);
      },
      remove: unexpected,
    },
  };
  return {
    snapshot: () => data,
    operation,
    commit,
    port,
    counts: () => ({ creates, adds }),
    remote,
  };
};
void test("creation with tags queues a separate durable followup and never duplicates creation", async () => {
  const f = setup();
  await deliverCreation(f.operation, f.commit, f.port);
  assert.deepEqual(f.counts(), { creates: 1, adds: 0 });
  const follow = f.snapshot().operations[0];
  assert.equal(follow?.type, "edit");
  if (follow?.type !== "edit") throw Error("Missing tags followup");
  assert.deepEqual(follow.patch, { tags: ["b"] });
  await deliverExisting(follow, f.snapshot, f.commit, f.port);
  assert.deepEqual(f.counts(), { creates: 1, adds: 1 });
  assert.equal(f.snapshot().operations.length, 0);
  assert.deepEqual(f.remote.tags, ["b"]);
});
void test("unavailable tag transport prevents tagged creation before any POST", async () => {
  const f = setup();
  delete f.port.tags;
  await assert.rejects(
    deliverCreation(f.operation, f.commit, f.port),
    /before creating/,
  );
  assert.deepEqual(f.counts(), { creates: 0, adds: 0 });
});
