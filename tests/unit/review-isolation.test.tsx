import assert from "node:assert/strict";
import test from "node:test";
import { seedAssigned } from "../../src/cloud/assigned-status";
import { cloudData } from "../../src/cloud/types";
import { deliveryCompletion } from "../../src/cloud/unavailable-tasks";
import type { TaskOperation } from "../../src/domain/types";
import { A, B, P, fixture } from "../fixtures/review-isolation";
for (const first of [true, false])
  for (const kind of ["scalar", "comment", "file"]) {
    void test(`missing dirty ticket ${first ? "before" : "after"} independent ${kind} is isolated`, async () => {
      const f = await fixture(),
        bad = f.edit(A, "missing"),
        safe = f.independent(kind);
      await f.store.change((data) => {
        data.operations = first ? [bad, safe] : [safe, bad];
        data.commentDrafts[A] = "Retained unsent draft";
      });
      f.remote.delete(A);
      await f.run();
      const { data } = f.store.getSnapshot();
      assert.deepEqual(f.sent(), [kind + ":" + B]);
      assert.deepEqual(data.operations, [bad]);
      assert.equal(data.commentDrafts[A], "Retained unsent draft");
      assert.equal(cloudData(data).records.safe?.status, "confirmed");
      assert.equal(cloudData(data).records.missing?.status, "conflict");
      assert.match(deliveryCompletion(data), /queued|review|waiting/i);
      await f.run();
      assert.deepEqual(
        f.sent(),
        [kind + ":" + B],
        "repeat cannot resend confirmed work",
      );
      if (kind === "file") assert.equal(f.uploads.size, 0);
    });
  }
void test("new same-field conflict is recorded while later unrelated edit completes", async () => {
  const f = await fixture(),
    bad = f.edit(A, "conflict"),
    safe = f.independent("scalar");
  await f.store.change((data) => {
    data.operations = [bad, safe];
  });
  f.remote.get(A)!.summary = "Competing remote title";
  await f.run();
  assert.deepEqual(f.sent(), ["scalar:" + B]);
  assert.deepEqual(f.state().operations, [bad]);
  assert.equal(cloudData(f.state()).records.conflict?.status, "conflict");
});
void test("multiple existing review records do not globally prevent independent scalar work", async () => {
  for (const automatic of [false, true]) {
    const f = await fixture(),
      first = f.edit(A, "one"),
      second: TaskOperation = {
        type: "comment",
        created: 1,
        issueId: A,
        opId: "two",
        text: "Held comment",
      };
    const safe = f.independent("scalar");
    await f.store.change((data) => {
      data.operations = [first, second, safe];
      data.cloud!.records = {
        one: { status: "conflict", message: "Review title" },
        two: { status: "uncertain", message: "Lost comment response" },
      };
    });
    await f.run(automatic);
    assert.deepEqual(f.sent(), ["scalar:" + B]);
    assert.deepEqual(f.state().operations, [first, second]);
    assert.equal(cloudData(f.state()).records.two?.status, "uncertain");
    await f.run(automatic);
    assert.deepEqual(f.sent(), ["scalar:" + B]);
  }
});
void test("same-ticket comment, parent move, creation and ancestor rollup cannot bypass held ticket", async () => {
  const f = await fixture(),
    held = f.edit(A, "held"),
    safe = f.independent("scalar");
  const move = f.edit(B, "move");
  assert.equal(move.type, "edit");
  if (move.type !== "edit") throw Error("fixture");
  move.patch = { parentId: A };
  const rollup = f.edit(P, "rollup");
  assert.equal(rollup.type, "edit");
  if (rollup.type !== "edit") throw Error("fixture");
  rollup.patch = { state: "Done", assignedState: "To do" };
  rollup.purpose = "rollup";
  const same: TaskOperation = {
    type: "comment",
    created: 1,
    issueId: A,
    opId: "same",
    text: "Held",
  };
  const child: TaskOperation = {
    type: "create",
    issueId: "local-held",
    opId: "child",
    item: { ...f.remote.get(A)!, id: "local-held", parentId: A },
  };
  await f.store.change((data) => {
    data.operations = [held, same, move, child, rollup, safe];
    data.cloud!.records.held = { status: "conflict", message: "Review title" };
    seedAssigned(data);
    data.cloud!.rollupPending = true;
  });
  await f.run();
  assert.deepEqual(f.sent(), ["scalar:" + B]);
  assert.deepEqual(f.state().operations, [held, same, move, child, rollup]);
  assert.notEqual(
    f.remote.get(P)!.state,
    "Done",
    "no false green ancestor through held child",
  );
  assert.notEqual(cloudData(f.state()).records.rollup?.status, "confirmed");
});
void test("lost response after dispatch stays uncertain and cannot masquerade as safe missing", async () => {
  const f = await fixture(),
    bad = f.edit(A, "lost"),
    safe = f.independent("scalar");
  await f.store.change((data) => {
    data.operations = [bad, safe];
  });
  let attempts = 0;
  f.port.update = () => {
    attempts++;
    return Promise.reject(Error("Response lost after request"));
  };
  assert.ok(await f.run());
  assert.equal(attempts, 2);
  assert.deepEqual(f.state().operations, [bad, safe]);
  assert.equal(cloudData(f.state()).records.lost?.status, "uncertain");
  assert.equal(cloudData(f.state()).records.safe?.status, "uncertain");
});

void test("reviewed create at queue head cannot starve independent work by repeated dependency promotion", async () => {
  const f = await fixture();
  const held: TaskOperation = {
    type: "create",
    issueId: "local-review",
    opId: "creation",
    item: { ...f.remote.get(A)!, id: "local-review", parentId: null },
  };
  const safe = f.independent("scalar");
  await f.store.change((data) => {
    data.operations = [held, safe];
    data.cloud!.records.creation = {
      status: "uncertain",
      message: "Creation response lost",
    };
  });
  await f.run();
  assert.deepEqual(f.sent(), ["scalar:" + B]);
  assert.deepEqual(f.state().operations, [held]);
  assert.equal(cloudData(f.state()).records.creation?.status, "uncertain");
});
