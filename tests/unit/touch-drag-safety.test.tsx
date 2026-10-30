import assert from "node:assert/strict";
import { test } from "node:test";
import type { PointerEvent } from "react";
import { startTaskDrag } from "../../src/components/romdex/task-drag-start";

test("touch and pen cannot start hierarchy dragging or capture scrolling", () => {
  for (const pointerType of ["touch", "pen", ""]) {
    const event = {
      pointerType,
      get target() {
        throw Error("Non-mouse gesture accessed drag target");
      },
    } as unknown as PointerEvent<HTMLElement>;
    assert.equal(startTaskDrag(event, ["PMON-1", "PMON-2"]), null);
  }
});
test("mouse still reaches existing desktop drag selection", () => {
  let checked = false;
  const event = {
    pointerType: "mouse",
    button: 0,
    target: {
      closest: () => {
        checked = true;
        return null;
      },
    },
  } as unknown as PointerEvent<HTMLElement>;
  assert.equal(startTaskDrag(event, []), null);
  assert.equal(checked, true);
});
