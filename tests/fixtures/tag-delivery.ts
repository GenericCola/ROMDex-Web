import assert from "node:assert/strict";
import type { Commit, DeliveryPort } from "../../src/cloud/types";
import { validateQueue } from "../../src/cloud/validation";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { normalize } from "../../src/youtrack/read-tasks";
import { rawIssue } from "./native-field-delivery";
export const tagDeliveryFixture = () => {
  let data = emptyWorkspace(),
    remote = { ...normalize(rawIssue()), tags: ["a"] },
    writes = 0,
    lose = false;
  data.operations = [
    {
      opId: "tags",
      type: "edit",
      issueId: remote.id,
      base: structuredClone(remote),
      patch: { tags: ["b"] },
    },
  ];
  data.cloud = { accountId: "fixture", autoSync: false, records: {} };
  const commit: Commit = async (update) => {
    const next = structuredClone(data);
    update(next);
    validateQueue(next);
    data = next;
  };
  const unexpected = async (): Promise<never> => {
    throw Error("Unexpected mutation");
  };
  const mutation = async (tag: string, add: boolean) => {
    assert.equal(data.cloud?.records.tags?.status, "attempting");
    assert.equal(
      data.cloud?.records.tags?.tagSteps?.at(-1)?.status,
      "attempting",
    );
    writes++;
    remote.tags = add
      ? [...remote.tags, tag]
      : remote.tags.filter((id) => id !== tag);
    if (lose) throw Error("Lost response");
  };
  const port: DeliveryPort = {
    accountId: "fixture",
    all: async () => [structuredClone(remote)],
    get: async () => structuredClone(remote),
    update: unexpected,
    comment: unexpected,
    prepareCreate: unexpected,
    create: unexpected,
    remove: unexpected,
    children: async () => [],
    tags: {
      prepare: async () => {},
      list: async () => [...remote.tags],
      add: async (_, id) => mutation(id, true),
      remove: async (_, id) => mutation(id, false),
    },
  };
  return {
    snapshot: () => data,
    commit,
    port,
    writes: () => writes,
    remote: () => remote,
    lose: () => {
      lose = true;
    },
    setRemote: (tags: string[]) => {
      remote.tags = tags;
    },
  };
};
