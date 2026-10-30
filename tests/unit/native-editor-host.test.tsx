import assert from "node:assert/strict";
import test from "node:test";
import { setAuthSession } from "../../src/auth/session";
import { itemEditorHost } from "../../src/components/romdex/item-editor-host";
import { editorItemSeed } from "../../src/components/romdex/item-editor-support";
import { taskAssigneeLabel } from "../../src/domain/task-assignee-label";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { workspaceStore } from "../../src/domain/workspace-store";
import { DeliveryClient } from "../../src/youtrack/delivery-client";
import {
  nativeFixtureFetch,
  rawIssue,
} from "../fixtures/native-field-delivery";
void test("schema loading returns the current item so original editor seeds newly discovered custom field baselines", async (t) => {
  t.mock.method(globalThis, "fetch", nativeFixtureFetch(rawIssue()));
  setAuthSession({
    token: "fixture-only",
    expiresAt: Date.now() + 60000,
    userId: "fixture",
    projectId: "0-1",
  });
  t.after(() => {
    setAuthSession(null);
  });
  const item = await new DeliveryClient("fixture-only").get("PMON-1");
  assert.ok(item);
  const snapshot = workspaceStore.getSnapshot();
  const data = {
    ...emptyWorkspace(),
    remote: [{ ...item, "custom:f-period": 150 }],
  };
  t.mock.method(workspaceStore, "change", async (update) => {
    update(data);
  });
  t.mock.method(workspaceStore, "flush", async () => {});
  t.mock.method(workspaceStore, "getSnapshot", () => {
    return {
      ...snapshot,
      data,
    };
  });
  const result = await itemEditorHost(item).loadEditOptions(item.id);
  assert.equal(result.item?.["custom:f-period"], 150);
  assert.ok(Array.isArray(result.options.custom));
});
void test("pending assignee labels never reuse another user's cached name or falsely show unassigned", async (t) => {
  t.mock.method(globalThis, "fetch", nativeFixtureFetch(rawIssue()));
  const item = await new DeliveryClient("fixture-only").get("PMON-1");
  assert.ok(item);
  item.assignees = [{ id: "1-1", name: "Fixture" }];
  assert.equal(taskAssigneeLabel({ ...item, assignee: "1-1" }), "Fixture");
  assert.equal(
    taskAssigneeLabel({ ...item, assignee: "1-2" }),
    "Unlisted Assignee",
  );
  assert.equal(taskAssigneeLabel({ ...item, assignee: null }), "Unassigned");
  assert.equal(editorItemSeed({ ...item, assignee: "1-2" }).assignee, "1-2");
  assert.equal(editorItemSeed({ ...item, assignee: null }).assignee, null);
});
