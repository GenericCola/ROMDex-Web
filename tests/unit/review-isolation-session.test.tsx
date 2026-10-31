import assert from "node:assert/strict";
import test from "node:test";
import { seedAssigned } from "../../src/cloud/assigned-status";
import { automaticBatch } from "../../src/cloud/automatic-batch";
import { connectionNeedsManualSave } from "../../src/cloud/connection-policy";
import { readRollupTree } from "../../src/cloud/rollup-tree";
import {
  automaticDelivery,
  connectDelivery,
  deliveryPaused,
  disconnectDelivery,
} from "../../src/cloud/session";
import type { TaskOperation } from "../../src/domain/types";
import { workspaceStore } from "../../src/domain/workspace-store";
import { A, fixture } from "../fixtures/review-isolation";
for (const status of [
  "conflict",
  "uncertain",
  "attempting",
  "ready",
  "orphan",
] as const) {
  void test(`reconnect ${status} uses ticket review holds rather than unsafe global resume`, async (t) => {
    const f = await fixture(),
      data = structuredClone(f.state());
    const held: TaskOperation =
      status === "ready"
        ? {
            type: "delete",
            issueId: A,
            opId: "held",
            ids: [A],
            bases: { [A]: f.remote.get(A)! },
          }
        : f.edit(A, "held");
    data.operations = [held, f.independent("scalar")];
    data.cloud!.records[status === "orphan" ? "unmatched" : "held"] = {
      status: status === "orphan" ? "uncertain" : status,
      message: "Retained review",
    };
    const state = {
      data,
      ready: true,
      error: "",
      pendingWrites: 0,
      connection: "",
      updating: false,
      delivering: false,
    };
    let deliveries = 0,
      selected: Set<string> | undefined;
    t.mock.method(workspaceStore, "start", () => {
      return Promise.resolve();
    });
    t.mock.method(workspaceStore, "getSnapshot", () => {
      return state;
    });
    t.mock.method(
      workspaceStore,
      "change",
      (update: (value: typeof data) => void) => {
        update(data);
        return Promise.resolve();
      },
    );
    t.mock.method(workspaceStore, "flush", () => {
      return Promise.resolve();
    });
    t.mock.method(workspaceStore, "setConnection", () => {
      return undefined;
    });
    t.mock.method(
      workspaceStore,
      "deliver",
      (_run: unknown, ids?: Set<string>) => {
        deliveries++;
        selected = ids;
        return Promise.resolve();
      },
    );
    t.mock.method(
      globalThis,
      "fetch",
      (_input: unknown, options?: RequestInit) => {
        assert.equal(
          options?.method,
          "GET",
          "session readiness test never sends ticket writes",
        );
        return Promise.resolve(Response.json({ id: "synthetic-owner" }));
      },
    );
    try {
      await connectDelivery("synthetic-review", "synthetic-owner");
      deliveries = 0;
      assert.equal(deliveryPaused(), status === "orphan");
      assert.equal(connectionNeedsManualSave(data), status === "orphan");
      await automaticDelivery();
      assert.equal(deliveries, status === "orphan" ? 0 : 1);
      if (status === "ready") {
        assert.deepEqual(
          [...selected!],
          ["safe"],
          "review-ready deletion requires manual consent but safe scalar proceeds",
        );
        data.operations = [held];
        assert.equal(automaticBatch(data)?.size, 0);
        deliveries = 0;
        await automaticDelivery();
        assert.equal(
          deliveries,
          0,
          "ready choice alone is not sent automatically",
        );
      }
      assert.equal(
        data.cloud!.records[status === "orphan" ? "unmatched" : "held"]!.status,
        status === "orphan" ? "uncertain" : status,
      );
    } finally {
      disconnectDelivery();
    }
  });
}
void test("held effective-status read computes on isolated assignment journal without destroying pending receipt", async () => {
  const f = await fixture(),
    data = structuredClone(f.state());
  seedAssigned(data);
  const op = f.edit(A, "held-rollup");
  if (op.type !== "edit") throw Error("fixture");
  op.purpose = "rollup";
  op.patch = { state: "Done", assignedState: "To do" };
  data.operations = [op];
  data.cloud!.rollupPending = true;
  data.cloud!.assigned![A]!.pendingState = "Done";
  data.cloud!.records[op.opId] = {
    status: "uncertain",
    message: "Readback pending",
  };
  const before = structuredClone(data.cloud!.assigned![A]);
  f.remote.get(A)!.state = "Done";
  f.remote.get(A)!.updated = 2;
  const tree = await readRollupTree(data, f.port);
  assert.deepEqual(data.cloud!.assigned![A], before);
  assert.equal(data.cloud!.records[op.opId]!.status, "uncertain");
  assert.equal(
    tree.items.find((item) => {
      return item.id === A;
    })!.state,
    "Done",
  );
  assert.notEqual(
    tree.next?.id,
    A,
    "held status cannot be dispatched by planning",
  );
});
