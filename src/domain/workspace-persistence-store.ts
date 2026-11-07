import { verifyRetainedAssets } from "@/migration/verify-assets";
import { WorkspaceStorage } from "@/storage/workspace-storage";
import { errorText } from "@utils/error-text";
import { assertBrowseOnly } from "./failed-save-browsing";
import { persistHierarchyRecovery } from "./hierarchy-recovery-store";
import { SaveQueue } from "./save-queue";
import { shareStructure } from "./share-structure";
import type { WorkspaceData, WorkspaceSnapshot } from "./types";
import { emptyWorkspace, validateWorkspace } from "./workspace-data";
import type { WorkspacePersistence } from "./workspace-lifecycle";
import { initialSnapshot } from "./workspace-snapshot";
export class WorkspacePersistenceStore {
  protected storage: WorkspacePersistence;
  protected revision = 0;
  protected generation = 0;
  protected switching = false;
  protected loading: Promise<void> | undefined;
  private listeners = new Set<() => void>();
  protected state = initialSnapshot();
  protected saves: SaveQueue;
  constructor(
    storage: WorkspacePersistence = new WorkspaceStorage(),
    /** Quiet period before a save starts, so fast typing writes once. */
    saveDelay = 0,
  ) {
    this.storage = storage;
    this.saves = new SaveQueue(this.persist, saveDelay);
  }
  getSnapshot = () => {
    return this.state;
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  protected publish = (patch: Partial<WorkspaceSnapshot>) => {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  };
  start = () => {
    this.loading ??= this.load();
    return this.loading;
  };
  protected load = async () => {
    const { generation } = this;
    try {
      const record = await this.storage.load();
      if (record) await verifyRetainedAssets(record.data);
      if (generation !== this.generation) return;
      this.revision = record?.revision ?? 0;
      this.publish({ data: record?.data ?? emptyWorkspace(), ready: true });
    } catch (error) {
      if (generation !== this.generation) return;
      this.publish({
        error: errorText(error, "Workspace could not load."),
      });
    }
  };
  protected write = (
    update: (data: WorkspaceData) => void,
    urgent = this.state.delivering,
  ) => {
    if (!this.state.ready || this.state.updating)
      throw Error(
        this.state.error ||
          (this.state.updating
            ? "An app update is being prepared."
            : "Wait for your workspace to open."),
      );
    const draft = structuredClone(this.state.data);
    update(draft);
    // Unchanged parts keep their identity so the UI can skip re-deriving them.
    const data = shareStructure(this.state.data, validateWorkspace(draft));
    if (this.state.error) {
      assertBrowseOnly(this.state.data, data, this.state.error);
      this.publish({ data });
      return Promise.resolve();
    }
    this.publish({ data, pendingWrites: this.state.pendingWrites + 1 });
    return this.saves.add(urgent);
  };
  /** Writes without the quiet period: internal steps that wait for the save. */
  protected writeNow = (update: (data: WorkspaceData) => void) => {
    return this.write(update, true);
  };
  /** Saves the newest snapshot for `count` changes; reports failures as state. */
  private persist = async (count: number) => {
    try {
      if (this.state.error) return;
      this.revision = await this.storage.save(this.state.data, this.revision);
    } catch (error) {
      this.publish({
        error: errorText(error, "Local saving failed."),
      });
    } finally {
      this.publish({ pendingWrites: this.state.pendingWrites - count });
    }
  };
  /** Starts any waiting save now (page hide, app update). */
  saveNow = () => {
    this.saves.now();
  };
  repairHierarchy = (
    ...args: Parameters<typeof persistHierarchyRecovery> extends [
      unknown,
      unknown,
      unknown,
      ...infer Rest,
    ]
      ? Rest
      : never
  ) => {
    return persistHierarchyRecovery(
      this.state,
      this.switching,
      this.writeNow,
      ...args,
    );
  };
  flush = async () => {
    let pending;
    do {
      pending = this.saves.settled();
      await pending;
    } while (pending !== this.saves.settled());
    if (this.state.error) throw Error(this.state.error);
  };
}
