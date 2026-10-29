import { hasDraftEdits } from "./editor-drafts";
import type { WorkspaceData } from "./types";
import { emptyWorkspace } from "./workspace-data";
import {
  prepareWorkspaceUpdate,
  type WorkspacePersistence,
} from "./workspace-lifecycle";
import { WorkspacePersistenceStore } from "./workspace-persistence-store";
import { exportWorkspace } from "./workspace-recovery";
import { hasWorkspaceWork } from "./workspace-work";
export type { WorkspacePersistence } from "./workspace-lifecycle";
export class WorkspaceStore extends WorkspacePersistenceStore {
  change = (update: (data: WorkspaceData) => void) => {
    if (this.state.delivering || this.switching)
      throw Error("Wait for cloud delivery or workspace switching to finish.");
    return this.write(update);
  };
  deliver = async (
    run: (
      commit: (update: (data: WorkspaceData) => void) => Promise<void>,
    ) => Promise<void>,
  ) => {
    if (
      this.switching ||
      this.state.delivering ||
      this.state.updating ||
      !this.state.ready ||
      this.state.error
    )
      throw Error("The workspace is not ready for cloud delivery.");
    this.publish({ delivering: true });
    const commit = async (update: (data: WorkspaceData) => void) => {
      await this.write(update);
      await this.flush();
    };
    try {
      await this.flush();
      await run(commit);
    } finally {
      this.publish({ delivering: false });
    }
  };
  prepareUpdate = () => {
    return prepareWorkspaceUpdate(
      this,
      (updating) => {
        this.publish({ updating });
      },
      () => {
        return this.switching;
      },
    );
  };
  switchPersistence = async (storage: WorkspacePersistence) => {
    if (
      this.switching ||
      this.state.delivering ||
      this.state.updating ||
      hasWorkspaceWork() ||
      hasDraftEdits()
    )
      throw Error(
        "Finish delivery, updates and draft edits before switching workspaces.",
      );
    this.switching = true;
    this.generation++;
    try {
      await this.flush();
      this.storage = storage;
      this.revision = 0;
      this.publish({
        data: emptyWorkspace(),
        ready: false,
        error: "",
        connection: "Not connected",
      });
      this.loading = this.load();
      await this.loading;
    } finally {
      this.switching = false;
    }
  };
  setConnection = (connection: string) => {
    return this.publish({ connection });
  };
  recover = () => {
    return exportWorkspace(this.state.data);
  };
}
export const workspaceStore = new WorkspaceStore();
