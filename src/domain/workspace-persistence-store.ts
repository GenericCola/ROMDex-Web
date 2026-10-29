import { verifyRetainedAssets } from "@/migration/verify-assets";
import { WorkspaceStorage } from "@/storage/workspace-storage";
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
      this.publish({ data: record?.data ?? emptyWorkspace(), ready: true });
    } catch (error) {
      if (generation !== this.generation) return;
      this.publish({
        error:
          error instanceof Error ? error.message : "Workspace could not load.",
      });
    }
  };
  protected write = (update: (data: WorkspaceData) => void) => {
    if (!this.state.ready || this.state.error || this.state.updating)
      throw Error(
        this.state.error ||
          (this.state.updating
            ? "An app update is being prepared."
            : "Wait for your workspace to open."),
      );
    const data = structuredClone(this.state.data);
    update(data);
    validateWorkspace(data);
    this.publish({ data, pendingWrites: this.state.pendingWrites + 1 });
    const persist = async () => {
      try {
        if (this.state.error) return;
        this.revision = await this.storage.save(data, this.revision);
      } catch (error) {
        this.publish({
          error:
            error instanceof Error ? error.message : "Local saving failed.",
        });
      } finally {
        this.publish({ pendingWrites: this.state.pendingWrites - 1 });
      }
    };
    this.writes = this.writes.then(persist);
    return this.writes;
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
