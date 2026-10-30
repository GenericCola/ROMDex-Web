import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailNavigationContext } from "../../src/components/romdex/detail-navigation-context";
import TaskWriting from "../../src/components/romdex/task-writing";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
const item: TaskItem = {
  id: "PMON-499",
  summary: "Fixture",
  description: "Fixture notes",
  state: "To Do",
  priority: "Normal",
  complexity: null,
  type: "Task",
  parentId: null,
  updated: 1,
  commentCount: 0,
  comments: [],
};
const nothing = () => {};
test("review keeps notes and comments tabs usable but their editors read-only", () => {
  const data = emptyWorkspace();
  data.remote = [item];
  data.commentDrafts[item.id] = "Kept fixture draft";
  for (const status of ["conflict", "uncertain", "ready"] as const) {
    data.cloud = {
      autoSync: false,
      records: { fixture: { status, message: "Review" } },
    };
    for (const tab of ["notes", "comments"] as const) {
      const html = renderToStaticMarkup(
        <DetailNavigationContext
          value={{
            tab,
            setTab: nothing,
            focusNotes: null,
            open: nothing,
            previous: null,
            back: nothing,
          }}
        >
          <TaskWriting item={item} data={data} />
        </DetailNavigationContext>,
      );
      assert.match(html, /<textarea[^>]*readOnly=""/i);
      assert.match(html, /aria-pressed="(?:true|false)"/);
      if (tab === "comments") {
        assert.match(html, /<button[^>]*disabled=""[^>]*>Post Comment/);
        assert.match(html, /Kept fixture draft/);
      }
    }
  }
});
test("transient comment read returns before persisted cache writes, guarded by account and selection lifetime", () => {
  const source = readFileSync(
    "src/components/romdex/use-task-comments.ts",
    "utf8",
  );
  assert.match(source, /previewRequired\(epoch, readOnly\)/);
  assert.match(
    source,
    /setPreview\(\{ id, comments, check: assertCurrent \}\);\s*return;/,
  );
  assert.match(source, /if \(!scope.active \|\| scope.id !== id\) return/);
  assert.match(source, /scope.active = false/);
  assert.match(source, /preview\?\.id === id/);
  assert.match(source, /preview.check\(\)/);
});
