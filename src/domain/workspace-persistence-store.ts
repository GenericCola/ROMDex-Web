import { verifyRetainedAssets } from "@/migration/verify-assets";
import { prepareImages, swapToRefs } from "@/storage/image-migration";
import { WorkspaceStorage } from "@/storage/workspace-storage";
import { errorText } from "@utils/error-text";
import { persistHierarchyRecovery } from "./hierarchy-recovery-store";
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
  private writes: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  protected state = initialSnapshot();
  constructor(storage: WorkspacePersistence = new WorkspaceStorage()) {
    this.storage = storage;
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
      const migrated = record ? await prepareImages(record.data) : {};
      if (generation !== this.generation) return;
      this.publish({ data: record?.data ?? emptyWorkspace(), ready: true });
      if (record && Object.keys(migrated).length)
        await this.moveImagesToRefs(record.data, migrated, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.publish({
        error: errorText(error, "Workspace could not load."),
      });
    }
  };
  private moveImagesToRefs = async (
    before: WorkspaceData,
    migrated: Record<string, string>,
    generation: number,
  ) => {
    try {
      if (generation !== this.generation) return;
      await this.write((data) => {
        swapToRefs(data, before, migrated);
      });
    } catch {
      // The legacy values stay valid; the next load tries again.
    }
  };
  protected write = (update: (data: WorkspaceData) => void) => {
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
      // Browsing is session-only while saving is unavailable. Never change the
      // queued operations, journal, drafts, or revision to make navigation work.
      const unchanged =
        JSON.stringify({ ...data, view: null }) ===
        JSON.stringify({ ...this.state.data, view: null });
      const moved =
        JSON.stringify(data.view) !== JSON.stringify(this.state.data.view);
      if (!unchanged || !moved) throw Error(this.state.error);
      this.publish({ data });
      return Promise.resolve();
    }
    this.publish({ data, pendingWrites: this.state.pendingWrites + 1 });
    const persist = async () => {
      try {
        if (this.state.error) return;
        this.revision = await this.storage.save(data, this.revision);
      } catch (error) {
        this.publish({
          error: errorText(error, "Local saving failed."),
        });
      } finally {
        this.publish({ pendingWrites: this.state.pendingWrites - 1 });
      }
    };
    this.writes = this.writes.then(persist);
    return this.writes;
  };
  retryLocalSave = () => {
    if (
      !this.state.ready ||
      !this.state.error ||
      this.state.updating ||
      this.state.delivering ||
      this.state.pendingWrites > 0
    )
      return Promise.reject(Error("No loaded workspace needs a save retry."));
    const retry = async () => {
      try {
        // Retain the original CAS revision. A conflict must never be resolved
        // by loading a newer revision and overwriting another window's work.
        this.revision = await this.storage.save(this.state.data, this.revision);
        this.publish({ error: "" });
      } catch (error) {
        this.publish({
          error: errorText(error, "Local saving failed."),
        });
        throw error;
      } finally {
        this.publish({ pendingWrites: this.state.pendingWrites - 1 });
      }
    };
    this.publish({ pendingWrites: this.state.pendingWrites + 1 });
    const result = this.writes.then(retry);
    this.writes = result.catch(() => {
      // Keep the queue usable; the caller and state retain the retry failure.
    });
    return result;
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
      this.write,
      ...args,
    );
  };
  flush = async () => {
    let pending;
    do {
      pending = this.writes;
      await pending;
    } while (pending !== this.writes);
    if (this.state.error) throw Error(this.state.error);
  };
}
