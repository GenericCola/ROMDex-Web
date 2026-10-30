import assert from "node:assert/strict";
import test from "node:test";
import {
  preserveRecoverySignIn,
  recoveryMode,
} from "../../src/auth/recovery-mode";
import { HierarchyQuarantine } from "../../src/cloud/hierarchy-quarantine";
import {
  connectDelivery,
  requireDelivery,
  saveDelivery,
} from "../../src/cloud/session";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
test("recovery query pauses before connect/save and survives callback root and retries", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window"),
    savedFetch = globalThis.fetch;
  const values = new Map<string, string>();
  let calls = 0;
  const fake = {
    location: { href: "https://romdex.vercel.app/?recovery=1" },
    sessionStorage: {
      setItem: (k: string, v: string) => values.set(k, v),
      getItem: (k: string) => values.get(k) ?? null,
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fake,
  });
  globalThis.fetch = async () => {
    calls++;
    throw Error("unexpected network");
  };
  try {
    const queued = emptyWorkspace();
    queued.operations.push(
      {
        opId: "move",
        type: "edit",
        issueId: "PMON-1",
        base: {} as TaskItem,
        patch: { parentId: "PMON-2" },
      },
      {
        opId: "note",
        type: "comment",
        issueId: "PMON-3",
        text: "retain unrelated",
        created: 1,
      },
    );
    const queuedBefore = JSON.stringify(queued),
      guard = new HierarchyQuarantine();
    guard.capture(queued);
    assert.throws(() => guard.assertSafe(queued), /Recovery mode/);
    assert.equal(JSON.stringify(queued), queuedBefore);
    const before = JSON.stringify(workspaceStore.getSnapshot().data);
    assert.equal(recoveryMode(), true);
    preserveRecoverySignIn();
    fake.location.href = "https://romdex.vercel.app/";
    for (let i = 0; i < 2; i++) {
      assert.equal(recoveryMode(), true);
      preserveRecoverySignIn();
      await assert.rejects(connectDelivery("unused"), /Recovery mode/);
      await assert.rejects(saveDelivery(), /Recovery mode/);
      await assert.rejects(saveDelivery(true), /Recovery mode/);
      assert.throws(() => requireDelivery(), /Recovery mode/);
    }
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(workspaceStore.getSnapshot().data), before);
  } finally {
    globalThis.fetch = savedFetch;
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
test("recovery OAuth refuses unavailable pause storage", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { href: "https://romdex.vercel.app/?recovery=1" },
      sessionStorage: {
        setItem: () => {
          throw Error("blocked");
        },
      },
    },
  });
  try {
    assert.equal(recoveryMode(), true);
    assert.throws(preserveRecoverySignIn, /tab storage/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
