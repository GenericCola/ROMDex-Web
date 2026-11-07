import assert from "node:assert/strict";
import type { WorkspaceData } from "../../src/domain/types";
import { emptyWorkspace } from "../../src/domain/workspace-data";

/** In-memory workspace persistence that checks every save against the loaded revision. */
export const memoryPersistence = (
  data: WorkspaceData = emptyWorkspace(),
  revision = 0,
) => {
  return {
    /** The last saved workspace. */
    get data() {
      return data;
    },
    load: () => {
      return Promise.resolve({ data: structuredClone(data), revision });
    },
    save: (next: WorkspaceData, expected: number) => {
      assert.equal(expected, revision);
      data = structuredClone(next);
      return Promise.resolve(++revision);
    },
  };
};

/** Empty persistence whose workspace carries a label in its comment drafts. */
export const labelledPersistence = (label: string, revision = 0) => {
  const data = emptyWorkspace();
  data.commentDrafts.label = label;
  return memoryPersistence(data, revision);
};
