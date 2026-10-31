import assert from "node:assert/strict";
import test from "node:test";
import type { MouseEvent, PointerEvent } from "react";
import { dragHookHarness } from "../fixtures/drag-hook-harness";
interface Rendered {
  props?: {
    className?: string;
    children?: Rendered | Rendered[];
    onClick?: () => void;
  };
}
const noop = () => {
  return undefined;
};
for (const [cancellation, active, bulk] of [
  ["Escape", true, false],
  ["pointercancel", true, false],
  ["up", true, false],
  ["Escape", false, false],
  ["pointercancel", false, false],
  ["Escape", true, true],
  ["pointercancel", true, true],
] as const) {
  void test(`${active ? "active" : "below-threshold"} ${bulk ? "bulk" : "selector"} drag ${cancellation} release-click policy`, async (t) => {
    let now = 1000;
    t.mock.method(Date, "now", () => {
      return now;
    });
    const f = await dragHookHarness();
    try {
      const data = f.emptyWorkspace();
      data.remote = ["PMON-2", "PMON-3"].map((id) => {
        return {
          id,
          summary: id,
          description: "",
          parentId: null,
          state: "To do",
          priority: "Normal",
          complexity: null,
          type: "Task",
          updated: 1,
          comments: [],
          commentCount: 0,
        };
      });
      let revision = 0;
      await f.workspaceStore.switchPersistence({
        load: () => {
          return Promise.resolve({ data, revision });
        },
        save: () => {
          return Promise.resolve(++revision);
        },
      });
      let clears = 0;
      const ids = ["PMON-2", "PMON-3"];
      if (bulk) {
        Object.assign(f.harness.start, { bulkIds: ids });
        f.harness.preview = {
          intent: { dragId: ids[0], targetId: ids[1], delta: 0, after: true },
          result: { parentId: null, beforeId: null, depth: 0 },
        };
      }
      const drag = f.useTaskDrag(bulk ? ids : [], () => {
        clears++;
      });
      f.mount();
      const pointer = {
        pointerId: 1,
        clientX: 20,
        clientY: 20,
        preventDefault: noop,
        stopPropagation: noop,
      } as unknown as PointerEvent<HTMLElement>;
      drag.handlers.onPointerDown(pointer);
      if (active) drag.handlers.onPointerMove(pointer);
      assert.equal(f.harness.start.active, active);
      if (cancellation === "Escape")
        f.listeners.get("keydown")!({ key: "Escape", preventDefault: noop });
      else if (cancellation === "pointercancel")
        drag.handlers.onPointerCancel();
      else drag.handlers.onPointerUp(pointer);
      assert.equal(drag.pending(), false);
      drag.handlers.onPointerUp(pointer);
      let prevented = false;
      drag.handlers.onClickCapture({
        preventDefault: () => {
          prevented = true;
        },
        stopPropagation: noop,
      } as unknown as MouseEvent<HTMLElement>);
      const element = f.SelectorBranch({
        item: data.remote[1]!,
        tree: f.indexTree(data.remote),
        data,
        setSettingsId: noop,
      }) as unknown as Rendered;
      const find = (node: Rendered | null | undefined): Rendered | null => {
        if (!node || typeof node !== "object") return null;
        if (node.props?.className === "selector-main") return node;
        for (const child of [node.props?.children].flat()) {
          const found = find(child);
          if (found) return found;
        }
        return null;
      };
      const selector = find(element);
      assert.ok(selector, "actual SelectorBranch main button found");
      if (!prevented) selector.props?.onClick?.();
      await f.workspaceStore.flush();
      assert.equal(
        f.workspaceStore.getSnapshot().data.view.scope,
        active ? null : "PMON-3",
        "release-click after cancelled active drag changed workspace scope",
      );
      assert.equal(prevented, active);
      assert.equal(clears, 0, "cancel must retain the checked selection");
      assert.deepEqual(
        f.workspaceStore.getSnapshot().data.operations,
        [],
        "cancel must not commit a move",
      );
      if (active) {
        now += 350;
        prevented = false;
        drag.handlers.onClickCapture({
          preventDefault: () => {
            prevented = true;
          },
          stopPropagation: noop,
        } as unknown as MouseEvent<HTMLElement>);
        assert.equal(
          prevented,
          false,
          "suppression expires after the original350ms",
        );
      }
    } finally {
      await f.dispose();
    }
  });
}
