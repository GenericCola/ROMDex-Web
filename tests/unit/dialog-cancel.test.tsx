import assert from "node:assert/strict";
import test from "node:test";
import { cancelDialog } from "../../src/components/romdex/dialog-cancel";
void test("Escape cancellation is consumed by the top dialog, never its enclosing attachment dialog", () => {
  const calls: string[] = [];
  const event = {
    preventDefault: () => {
      calls.push("prevent");
    },
    stopPropagation: () => {
      calls.push("stop");
    },
  };
  cancelDialog(event, true, () => {
    calls.push("close top");
  });
  assert.deepEqual(calls, ["prevent", "stop", "close top"]);
  calls.length = 0;
  cancelDialog(event, false, () => {
    calls.push("must not close");
  });
  assert.deepEqual(calls, ["prevent", "stop"]);
});
