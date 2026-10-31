import assert from "node:assert/strict";
import test from "node:test";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { reviewQueue } from "../../src/cloud/review";
import { cloudData } from "../../src/cloud/types";
import { deliveryCompletion } from "../../src/cloud/unavailable-tasks";
import { editTask } from "../../src/domain/task-actions";
import { A, B, P, fixture } from "../fixtures/review-isolation";
const Q = "PMON-900004";
for (const automatic of [false, true]) {
  void test(`${automatic ? "automatic" : "explicit"} status delivery derives independent branch but holds reviewed ancestors`, async () => {
    const f = await fixture();
    await f.store.change((data) => {
      data.remote.push({
        ...data.remote[0]!,
        id: Q,
        summary: "Independent parent",
      });
      data.remote.find((item) => {
        return item.id === B;
      })!.parentId = Q;
      const held = data.remote.find((item) => {
        return item.id === A;
      })!;
      held.state = "Done";
      held.assignedState = "Done";
    });
    for (const item of f.state().remote)
      f.remote.set(item.id, structuredClone(item));
    const held = f.edit(A, "held"),
      independent = f.edit(B, "status");
    if (independent.type !== "edit") throw Error("fixture");
    independent.patch = { assignedState: "Done" };
    await f.store.change((data) => {
      data.operations = [held, independent];
      data.cloud!.records.held = {
        status: "conflict",
        message: "Review A title",
      };
    });
    const { update } = f.port;
    let observedDynamicLock = false;
    f.port.update = async (id, patch, expected) => {
      if (id === Q) {
        observedDynamicLock = true;
        assert.ok(
          f.store.deliveryTickets().has(Q),
          "generated parent rollup is delivery-locked",
        );
        assert.ok(
          f.store.deliveryTickets().has(B),
          "generated rollup locks dependency child",
        );
        await assert.rejects(async () => {
          await f.store.change((data) => {
            editTask(data, B, { description: "Must not race rollup" });
          });
        }, /synchroniz|review|locked/i);
      }
      return update(id, patch, expected);
    };
    const outcome = await f.run(automatic);
    assert.equal(f.remote.get(B)!.state, "Done");
    assert.equal(
      f.remote.get(Q)!.state,
      "Done",
      "independent derived parent must not await review elsewhere: " +
        String(outcome),
    );
    assert.equal(observedDynamicLock, true);
    assert.equal(
      f.remote.get(P)!.state,
      "To do",
      "held branch cannot turn falsely green",
    );
    assert.deepEqual(f.sent(), ["scalar:" + B, "scalar:" + Q]);
    assert.ok(
      f.state().operations.some((op) => {
        return op.opId === held.opId;
      }),
    );
    const deferred = f.state().operations.find((op) => {
      return op.type === "edit" && op.purpose === "rollup" && op.issueId === P;
    });
    assert.ok(
      deferred,
      "reviewed parent's needed rollup remains explicitly queued",
    );
    assert.notEqual(
      cloudData(f.state()).records[deferred.opId]?.status,
      "confirmed",
    );
    assert.equal(
      cloudData(f.state()).rollupPending,
      true,
      "deferred rollup remains honestly pending",
    );
    assert.equal(
      automaticBatch(f.state())?.size,
      0,
      "review-only pending work does not spin automatic delivery",
    );
    assert.match(deliveryCompletion(f.state()), /queued|review|waiting/i);
    assert.equal(
      f.store.deliveryTickets().size,
      0,
      "batch releases transient locks",
    );
    const writes = [...f.sent()];
    await f.run(automatic);
    assert.deepEqual(
      f.sent(),
      writes,
      "review hold never repeats successful writes",
    );
    await f.store.deliver((commit) => {
      return reviewQueue(
        f.state(),
        commit,
        {
          ...f.port,
          verifyComment: () => {
            return Promise.reject(Error("Unexpected comment verification"));
          },
        },
        held.opId,
        "cloud",
      );
    });
    await f.run(automatic);
    assert.equal(
      f.remote.get(P)!.state,
      "Done",
      "deferred ancestor wakes after explicit conflict resolution",
    );
    assert.equal(f.state().operations.length, 0);
    assert.deepEqual(f.sent(), [...writes, "scalar:" + P]);
  });
}
