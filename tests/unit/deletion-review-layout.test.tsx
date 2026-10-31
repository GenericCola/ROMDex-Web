import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DeliveryRecord } from "../../src/cloud/types";
import DeletionReviewActions from "../../src/components/romdex/deletion-review-actions";
import type { TaskOperation } from "../../src/domain/types";
const operation: Extract<TaskOperation, { type: "delete" }> = {
  type: "delete",
  opId: "legacy",
  issueId: "PMON-1",
  ids: ["PMON-1", "PMON-2"],
};
test("legacy missing-target review exposes checked clear first, not another delete", () => {
  const record: DeliveryRecord = {
    status: "conflict",
    message: "A deletion target is missing or unreadable.",
  };
  let calls = 0;
  const html = renderToStaticMarkup(
    <DeletionReviewActions
      operation={operation}
      record={record}
      busy={false}
      execute={async () => {
        calls++;
      }}
    />,
  );
  assert.match(html, /<details open=""><summary>Already deleted in YouTrack\?/);
  assert.ok(
    html.indexOf("Clear already-deleted") <
      html.indexOf("I still want to delete"),
  );
  assert.match(html, /disabled="">Clear already-deleted/);
  assert.match(html, /PMON-1, PMON-2/);
  assert.equal(calls, 0);
});
