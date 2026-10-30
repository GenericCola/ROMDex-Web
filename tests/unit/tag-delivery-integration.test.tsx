import assert from "node:assert/strict";
import test from "node:test";
import { deliverExisting } from "../../src/cloud/existing-delivery";
import { reviewQueue } from "../../src/cloud/review";
import { tagDeliveryFixture } from "../fixtures/tag-delivery";
const operation = (f: ReturnType<typeof tagDeliveryFixture>) => {
  const op = f.snapshot().operations[0];
  if (op?.type !== "edit") throw Error("Missing edit");
  return op;
};
void test("tag edit follows full durable queue path and retains exact confirmed steps", async () => {
  const f = tagDeliveryFixture();
  await deliverExisting(operation(f), f.snapshot, f.commit, f.port);
  assert.equal(f.writes(), 2);
  assert.deepEqual(f.remote().tags, ["b"]);
  assert.equal(f.snapshot().operations.length, 0);
  assert.deepEqual(
    f.snapshot().cloud?.records.tags?.tagSteps?.map((s) => s.status),
    ["confirmed", "confirmed"],
  );
});
void test("concurrent tag membership becomes a review conflict before any write", async () => {
  const f = tagDeliveryFixture();
  f.setRemote(["a", "c"]);
  await assert.rejects(
    deliverExisting(operation(f), f.snapshot, f.commit, f.port),
    /conflicting/,
  );
  assert.equal(f.writes(), 0);
  assert.equal(f.snapshot().cloud?.records.tags?.status, "conflict");
});
void test("lost tag mutation is held and explicit fresh rebase preserves history without replay", async () => {
  const f = tagDeliveryFixture();
  f.lose();
  await assert.rejects(
    deliverExisting(operation(f), f.snapshot, f.commit, f.port),
    /uncertain/,
  );
  assert.equal(f.writes(), 1);
  assert.deepEqual(f.remote().tags, []);
  await reviewQueue(
    f.snapshot(),
    f.commit,
    {
      ...f.port,
      verifyComment: async () => {
        throw Error("Unexpected comment");
      },
    },
    "tags",
    "local",
  );
  assert.equal(f.writes(), 1);
  assert.equal(
    f.snapshot().cloud?.records.tags?.tagSteps?.[0]?.status,
    "attempting",
  );
  assert.notEqual(f.snapshot().operations[0]?.opId, "tags");
});
void test("missing native tag preparation blocks mutation and preserves operation", async () => {
  const f = tagDeliveryFixture();
  delete f.port.tags!.prepare;
  await assert.rejects(
    deliverExisting(operation(f), f.snapshot, f.commit, f.port),
    /fresh native preparation/,
  );
  assert.equal(f.writes(), 0);
  assert.equal(f.snapshot().operations.length, 1);
});

void test("operation changed during final tag read blocks dispatch", async () => {
  const f = tagDeliveryFixture();
  const list = f.port.tags!.list;
  let reads = 0;
  f.port.tags!.list = async (id) => {
    const result = await list(id);
    reads++;
    // Native baseline, then preclaim read, then final predispatch read.
    if (reads === 3) {
      const current = f.snapshot().operations[0];
      if (current?.type === "edit") current.patch.tags = ["c"];
    }
    return result;
  };
  await assert.rejects(
    deliverExisting(operation(f), f.snapshot, f.commit, f.port),
  );
  assert.equal(f.writes(), 0);
});
