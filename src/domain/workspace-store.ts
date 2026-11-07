import { guardDeliveryBrowsing } from "./delivery-browsing";
import { batchOperationIds, deliveryTicketLocks } from "./delivery-locks";
import { hasDraftEdits } from "./editor-drafts";
import { persistIncoming } from "./incoming-store";
import { guardReviewBrowsing } from "./review-browsing";
import type { TaskItem, WorkspaceData } from "./types";
import { emptyWorkspace } from "./workspace-data";
import type { WorkspacePersistence } from "./workspace-lifecycle";
import { prepareWorkspaceUpdate } from "./workspace-lifecycle";
import { exportWorkspace } from "./workspace-recovery";
import { WorkspaceSaveStore } from "./workspace-save-store";
import { hasWorkspaceWork } from "./workspace-work";
export type { WorkspacePersistence } from "./workspace-lifecycle";
export class WorkspaceStore extends WorkspaceSaveStore {
  private deliveryCount = 0;
  private activeOperations = new Set<string>();
  private activeTickets = new Set<string>();
  deliveryTickets = () => {
    return new Set(this.activeTickets);
  };
  workspaceEpoch = () => {
    return this.generation;
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
  applyIncoming = (
    items: TaskItem[],
    held: Set<string>,
    assertCurrent: () => void,
    complete = true,
  ) => {
    return persistIncoming(
      this.state,
      this.switching,
      this.writeNow,
      this.flush,
      items,
      new Set([...held, ...this.activeTickets]),
      assertCurrent,
      complete,
    );
  };
  deliver = async (
    run: (
      commit: (update: (data: WorkspaceData) => void) => Promise<void>,
    ) => Promise<void>,
    selected?: Set<string>,
  ) => {
    if (
      this.switching ||
      this.state.delivering ||
      this.state.updating ||
      !this.state.ready ||
      this.state.error
    )
      throw Error("The workspace is not ready for cloud delivery.");
    this.activeOperations = batchOperationIds(this.state.data, selected);
    this.activeTickets = deliveryTicketLocks(
      this.state.data,
      this.activeOperations,
      !selected,
    );
    this.deliveryCount++;
    this.publish({ delivering: true });
    const commit = async (update: (data: WorkspaceData) => void) => {
      await this.writeNow((data) => {
        update(data);
        for (const id of deliveryTicketLocks(
          data,
          this.activeOperations,
          !selected,
        ))
          this.activeTickets.add(id);
      });
      await this.flush();
      this.activeTickets = deliveryTicketLocks(
        this.state.data,
        this.activeOperations,
        !selected,
      );
      this.publish({});
    };
    try {
      await this.flush();
      await run(commit);
    } finally {
      // A read that started during this delivery may predate its writes; end the epoch so it cannot apply.
      this.deliveryCount++;
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
      await (this.loading = this.load());
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
// No added wait: changes made while a save runs join the next save. A timed
// quiet period kept awaited edits (rename, Escape) busy for too long.
export const workspaceStore = new WorkspaceStore();
