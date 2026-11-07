import assert from "node:assert/strict";
import { test } from "node:test";
import type { WorkspaceData } from "../../src/domain/types";
import {
  emptyWorkspace,
  validateWorkspace,
} from "../../src/domain/workspace-data";
import { taskItem } from "../fixtures/task-item";

test("a record saved by the retired shared-status mode still loads", () => {
  const data = emptyWorkspace();
  data.remote = [
    {
      ...taskItem("PMON-1"),
      sharedStatus: { schema: 1, id: "PMON-1", revision: 4 },
    } as never,
  ];
  data.cloud = {
    autoSync: false,
    sharedStatuses: true,
    records: {
      old: {
        status: "confirmed",
        message: "Done",
        metadataWrite: { schema: 1, opId: "old", kind: "assign" },
      },
    },
  } as never;
  const loaded: WorkspaceData = validateWorkspace(structuredClone(data));
  assert.equal(loaded.remote[0]?.id, "PMON-1");
  assert.equal(loaded.cloud?.records.old?.status, "confirmed");
});
