import { guardDeliveryBrowsing } from "./delivery-browsing";
import { hasDraftEdits } from "./editor-drafts";
import { guardReviewBrowsing } from "./review-browsing";
import { operationTicketIds } from "./ticket-locks";
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
  private deliveryCount = 0;
  private activeOperations = new Set<string>();
  private activeTickets = new Set<string>();
  deliveryTickets = () => {
    return new Set(this.activeTickets);
  };
  deliveryEpoch = () => {
    return this.deliveryCount;
  };
  change = (update: (data: WorkspaceData) => void) => {
    if (this.switching)
      throw Error("Wait for cloud delivery or workspace switching to finish.");
    return this.write((data) => {
      update(data);
      if (this.state.delivering)
        guardDeliveryBrowsing(this.state.data, data, this.activeTickets);
      guardReviewBrowsing(this.state.data, data);
    });
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
    this.activeOperations = new Set(
      this.state.data.operations.flatMap((op) => {
        return op.type === "create"
          ? [op.opId, op.opId + ":parent", op.opId + ":tags"]
          : [op.opId];
      }),
    );
    this.activeTickets = new Set(
      this.state.data.operations.flatMap((op) => {
        return [...operationTicketIds(op)];
      }),
    );
    this.deliveryCount++;
    this.publish({ delivering: true });
    const commit = async (update: (data: WorkspaceData) => void) => {
      await this.write((data) => {
        update(data);
        for (const op of data.operations) {
          if (
            this.activeOperations.has(op.opId) ||
            (op.type === "edit" && op.purpose === "rollup")
          ) {
            for (const id of operationTicketIds(op)) this.activeTickets.add(id);
            if (op.type === "edit" && op.purpose === "rollup") {
              let changed = true;
              while (changed) {
                changed = false;
                for (const item of data.remote)
                  if (
                    item.parentId &&
                    this.activeTickets.has(item.parentId) &&
                    !this.activeTickets.has(item.id)
                  ) {
                    this.activeTickets.add(item.id);
                    changed = true;
                  }
              }
            }
          }
        }
      });
      await this.flush();
    };
    try {
      await this.flush();
      await run(commit);
    } finally {
      this.activeTickets.clear();
      this.activeOperations.clear();
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
