import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeliveryRecord } from "../../src/cloud/types";
import DeliveryReview from "../../src/components/romdex/delivery-review";
import type { TaskItem, TaskOperation } from "../../src/domain/types";
import { workspaceStore } from "../../src/domain/workspace-store";
const task: TaskItem = {
  id: "PMON-499",
  summary: "Synthetic paused ticket",
  description: "Private notes",
  parentId: null,
  state: "To do",
  priority: "Normal",
  complexity: null,
  type: "Task",
  updated: 1,
  comments: [],
  commentCount: 0,
};
const edit: TaskOperation = {
  type: "edit",
  issueId: task.id,
  opId: "fixture",
  base: task,
  patch: { priority: "High" },
};
const render = (
  operation: TaskOperation | undefined,
  status: DeliveryRecord["status"] = "uncertain",
  busy = false,
  conflicts?: DeliveryRecord["conflicts"],
) => {
  const original = workspaceStore.getSnapshot,
    originalFetch = globalThis.fetch;
  const snapshot = structuredClone(original());
  snapshot.data.remote = [task];
  snapshot.data.operations = operation ? [operation] : [];
  const record: DeliveryRecord = {
    status,
    message: "Synthetic request interrupted before confirmation",
    ...(conflicts ? { conflicts } : {}),
  };
  snapshot.data.cloud = { autoSync: true, records: { fixture: record } };
  const before = JSON.stringify(snapshot);
  let calls = 0;
  workspaceStore.getSnapshot = () => snapshot;
  globalThis.fetch = async () => {
    calls++;
    throw Error("No network allowed");
  };
  const execute = async () => {
    calls++;
    throw Error("No review action allowed on render");
  };
  try {
    const html = renderToStaticMarkup(
      <DeliveryReview
        id="fixture"
        record={record}
        busy={busy}
        execute={execute}
      />,
    );
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(snapshot), before);
    return html;
  } finally {
    workspaceStore.getSnapshot = original;
    globalThis.fetch = originalFetch;
  }
};
test("paused edit names the task, exposes reason and explains safe choices without executing them", () => {
  const html = render(edit);
  assert.match(html, /Review PMON-499 · Synthetic paused ticket/);
  assert.match(html, /do not know whether the earlier attempt saved/);
  assert.match(html, /Check whether this saved/);
  assert.doesNotMatch(html, /Use my changes/);
  assert.match(html, /will not send it again/);
  assert.match(html, /recovery history/);
});
test("create and attachment reviews never offer an edit retry; missing operations cannot act", () => {
  const created = render({
    type: "create",
    issueId: "local-fixture",
    opId: "fixture",
    item: { ...task, id: "local-fixture" },
  });
  assert.match(created, /Exact created issue ID/);
  assert.match(created, /Do not create it again to check/);
  assert.doesNotMatch(created, /Use my changes/);
  const comment = render({
    type: "comment",
    issueId: task.id,
    opId: "fixture",
    text: "Retain comment",
    created: 1,
  });
  assert.doesNotMatch(comment, /Use my changes/);
  assert.match(comment, /Review PMON-499 · Synthetic paused ticket/);
  const upload = render({
    type: "attachment",
    issueId: task.id,
    opId: "fixture",
    uploadId: "local-file",
    file: { name: "keep.txt", size: 4, mimeType: "text/plain", hash: "abc" },
  });
  assert.match(upload, /Read Current Attachment IDs/);
  assert.match(upload, /Stop upload; archive pending file/);
  assert.doesNotMatch(upload, /Use my changes/);
  const missing = render(undefined);
  assert.equal((missing.match(/<button disabled=""/g) ?? []).length, 2);
  const busy = render(edit, "conflict", true);
  assert.equal((busy.match(/<button disabled=""/g) ?? []).length, 3);
});

test("assigned status review presents both named choices before optional raw diagnostics", () => {
  const html = render(
    { ...edit, type: "edit", base: task, patch: { assignedState: "Done" } },
    "conflict",
    false,
    [
      {
        field: "assignedState",
        base: "Critical / Debugging",
        local: "Done",
        remote: "Needs Testing",
      },
    ],
  );
  assert.match(html, /Use my choice: Done/);
  assert.match(html, /Keep YouTrack: Needs Testing/);
  assert.ok(html.indexOf("Use my choice") < html.indexOf("<details>"));
  assert.doesNotMatch(html, /<details open/);
  assert.match(html, /YOUR CHANGE: Done/);
  assert.match(html, /CURRENT YOUTRACK: Needs Testing/);
});
