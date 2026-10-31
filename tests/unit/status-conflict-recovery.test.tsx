import assert from "node:assert/strict";
import test from "node:test";
import { reviewQueue } from "../../src/cloud/review";
import type { TaskItem } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";
import { navigationPort } from "../fixtures/navigation-port";

test("concurrent status choices resolve generically by readback, never write or drop unrelated work", async () => {
  for (const id of ["PMON-900051", "PMON-900052"]) {
    for (const choice of ["local", "cloud"] as const) {
      const base: TaskItem = {
        id,
        summary: "Synthetic status review",
        description: "Private notes retained",
        parentId: null,
        state: "Critical / Debugging",
        assignedState: "Critical / Debugging",
        priority: "Normal",
        complexity: null,
        type: "Task",
        updated: 1,
        comments: [],
        commentCount: 0,
      };
      const latest = {
        ...base,
        state: "Needs Testing",
        assignedState: "Needs Testing",
        updated: 2,
      };
      const data = emptyWorkspace();
      data.remote = [base];
      data.operations = [
        {
          opId: "status",
          type: "edit",
          issueId: id,
          base,
          patch: { assignedState: "Done" },
        },
        {
          opId: "other",
          type: "comment",
          issueId: id,
          text: "Retained queued comment",
          created: 1,
        },
      ];
      data.commentDrafts[id] = "Retained draft";
      data.cloud = {
        autoSync: true,
        accountId: "synthetic-owner",
        records: {
          status: {
            status: "conflict",
            message: "Both changed",
            conflicts: [
              {
                field: "assignedState",
                base: "Critical / Debugging",
                local: "Done",
                remote: "Needs Testing",
              },
            ],
          },
        },
      };
      const { port, sent } = navigationPort([latest]);
      await reviewQueue(
        data,
        async (update) => {
          update(data);
        },
        { ...port, verifyComment: async () => {} },
        "status",
        choice,
      );
      assert.deepEqual(sent, []);
      assert.equal(data.commentDrafts[id], "Retained draft");
      assert.equal(
        data.operations.find((op) => op.opId === "other")?.type,
        "comment",
      );
      if (choice === "local") {
        const retained = data.operations.find((op) => op.opId === "status");
        assert.equal(retained?.type, "edit");
        if (retained?.type === "edit") {
          assert.equal(retained.patch.assignedState, "Done");
          assert.equal(retained.base.state, "Needs Testing");
        }
        assert.equal(data.cloud?.records.status, undefined);
      } else {
        assert.equal(
          data.operations.some((op) => op.opId === "status"),
          false,
        );
        assert.equal(data.cloud?.records.status?.status, "confirmed");
        assert.equal(
          data.cloud?.records.status?.archivedOperation?.type,
          "edit",
        );
        assert.equal(data.remote[0]?.state, "Needs Testing");
      }
    }
  }
});
