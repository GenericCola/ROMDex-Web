import assert from "node:assert/strict";
import test from "node:test";
import { attemptDelivery } from "../../src/cloud/journal";
import { deliverTags } from "../../src/cloud/tag-delivery";
import type { TagPort } from "../../src/cloud/tag-types";
import type { Commit } from "../../src/cloud/types";
import type { TaskOperation } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { normalize } from "../../src/youtrack/read-tasks";
import { rawIssue } from "../fixtures/native-field-delivery";
const fixture = () => {
  const data = emptyWorkspace();
  const operation: Extract<TaskOperation, { type: "edit" }> = {
    opId: "tag-edit",
    type: "edit",
    issueId: "PMON-1",
    base: { ...normalize(rawIssue()), tags: ["tag-a"] },
    patch: { tags: ["tag-b"] },
  };
  data.operations = [operation];
  data.cloud = { accountId: "user", autoSync: false, records: {} };
  const commit: Commit = async (update) => {
    await Promise.resolve();
    update(data);
  };
  let remote = ["tag-a"],
    writes = 0,
    lose = false;
  const mutation = async (id: string, add: boolean) => {
    await Promise.resolve();
    const step = data.cloud?.records[operation.opId]?.tagSteps?.at(-1);
    assert.equal(step?.status, "attempting");
    assert.equal(step?.tagId, id);
    writes++;
    remote = add
      ? [...remote, id]
      : remote.filter((tag) => {
          return tag !== id;
        });
    if (lose) throw Error("Lost response");
  };
  const port: TagPort = {
    list: async () => {
      await Promise.resolve();
      return [...remote];
    },
    add: async (_, id) => {
      await mutation(id, true);
    },
    remove: async (_, id) => {
      await mutation(id, false);
    },
  };
  return {
    data,
    operation,
    commit,
    port,
    writes: () => {
      return writes;
    },
    lose: () => {
      lose = true;
    },
    change: () => {
      remote = ["external"];
    },
  };
};
void test("every native tag mutation has a durable exact step and confirmed readback", async () => {
  const f = fixture();
  await attemptDelivery(f.operation, f.commit, async () => {
    await deliverTags(
      f.operation,
      ["tag-a"],
      ["tag-b"],
      () => {
        return f.data;
      },
      f.commit,
      f.port,
    );
  });
  assert.equal(f.writes(), 2);
  assert.deepEqual(
    f.data.cloud?.records[f.operation.opId]?.tagSteps?.map((s) => {
      return [s.action, s.tagId, s.status];
    }),
    [
      ["remove", "tag-a", "confirmed"],
      ["add", "tag-b", "confirmed"],
    ],
  );
  await assert.rejects(
    deliverTags(
      f.operation,
      ["tag-a"],
      ["tag-b"],
      () => {
        return f.data;
      },
      f.commit,
      f.port,
    ),
    /not replay/,
  );
  assert.equal(f.writes(), 2);
});
void test("lost tag response leaves exact attempted evidence and no second dispatch", async () => {
  const f = fixture();
  f.lose();
  await assert.rejects(
    attemptDelivery(f.operation, f.commit, async () => {
      await deliverTags(
        f.operation,
        ["tag-a"],
        ["tag-b"],
        () => {
          return f.data;
        },
        f.commit,
        f.port,
      );
    }),
    /uncertain/,
  );
  assert.equal(f.writes(), 1);
  assert.equal(f.data.cloud?.records[f.operation.opId]?.status, "uncertain");
  assert.equal(
    f.data.cloud?.records[f.operation.opId]?.tagSteps?.[0]?.status,
    "attempting",
  );
});
void test("changed native membership blocks all tag mutations", async () => {
  const f = fixture();
  f.change();
  await assert.rejects(
    attemptDelivery(f.operation, f.commit, async () => {
      await deliverTags(
        f.operation,
        ["tag-a"],
        ["tag-b"],
        () => {
          return f.data;
        },
        f.commit,
        f.port,
      );
    }),
    /uncertain/,
  );
  assert.equal(f.writes(), 0);
});
