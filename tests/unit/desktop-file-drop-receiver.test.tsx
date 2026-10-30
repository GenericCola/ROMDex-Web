import assert from "node:assert/strict";
import test from "node:test";
const transfer = (files: File[]) => {
  return { types: ["Files"], files, items: [] } as unknown as DataTransfer;
};
void test("desktop drop receiver prevents navigation, targets only task rows and removes every listener on disposal", async () => {
  const { FileDropTarget } =
    await import("../../src/domain/accepted/file-drop.mjs");
  const listeners = new Map<string, (event: unknown) => unknown>(),
    windowListeners = new Map<string, unknown>();
  let removed = false,
    attached = 0,
    prevented = 0;
  const feedback = {
    id: "",
    className: "",
    hidden: true,
    textContent: "",
    setAttribute: () => {
      return undefined;
    },
    remove: () => {
      removed = true;
    },
  };
  const doc = {
    createElement: () => {
      return feedback;
    },
    body: {
      append: () => {
        return undefined;
      },
    },
    addEventListener: (key: string, fn: (event: unknown) => unknown) => {
      listeners.set(key, fn);
    },
    removeEventListener: (key: string) => {
      listeners.delete(key);
    },
    defaultView: {
      addEventListener: (key: string, fn: unknown) => {
        windowListeners.set(key, fn);
      },
      removeEventListener: (key: string) => {
        windowListeners.delete(key);
      },
    },
  } as unknown as Document;
  const row = {
    dataset: { row: "PMON-1" },
    getClientRects: () => {
      return [{}];
    },
    classList: {
      add: () => {
        return undefined;
      },
      remove: () => {
        return undefined;
      },
    },
  };
  const messages: string[] = [],
    file = new File(["fixture"], "fixture.txt");
  const target = new FileDropTarget({
    doc,
    item: (id) => {
      return id === "PMON-1" ? { id, summary: "Fixture" } : undefined;
    },
    notify: (message) => {
      messages.push(message);
    },
    attach: (id, files) => {
      assert.equal(id, "PMON-1");
      assert.deepEqual(files, [file]);
      attached++;
      return Promise.resolve(["upload-fixture"]);
    },
  });
  const event = {
    dataTransfer: transfer([file]),
    target: {
      closest: () => {
        return row;
      },
    },
    preventDefault: () => {
      prevented++;
    },
    stopImmediatePropagation: () => {
      return undefined;
    },
  };
  await listeners.get("drop")?.(event);
  assert.equal(attached, 1);
  assert.equal(prevented, 1);
  assert.equal(target.busy, false);
  assert.ok(
    messages.some((message) => {
      return message.includes("Added");
    }),
  );
  await listeners.get("drop")?.({
    ...event,
    target: {
      closest: () => {
        return null;
      },
    },
  });
  assert.equal(attached, 1);
  assert.equal(prevented, 2);
  target.dispose();
  assert.equal(listeners.size, 0);
  assert.equal(windowListeners.size, 0);
  assert.equal(removed, true);
});
