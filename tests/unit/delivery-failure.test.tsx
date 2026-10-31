import assert from "node:assert/strict";
import test from "node:test";
import { reportDeliveryFailure } from "../../src/cloud/delivery-failure";
import { deliveryMessage } from "../../src/components/romdex/header-status";
import { workspaceStore } from "../../src/domain/workspace-store";
test("latest explicit Save failure replaces stale automatic conflict without changing any local data", () => {
  const before = JSON.stringify(workspaceStore.getSnapshot().data);
  workspaceStore.setConnection("Automatic delivery paused: old conflict");
  reportDeliveryFailure(Error("Parent status read failed"));
  const state = workspaceStore.getSnapshot();
  assert.equal(state.connection, "Save stopped: Parent status read failed");
  assert.equal(deliveryMessage(state, null), state.connection);
  assert.equal(JSON.stringify(state.data), before);
});
