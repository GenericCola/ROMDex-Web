import { WorkspaceStorage } from "@/storage/workspace-storage";
import type { WorkspaceData, WorkspaceSnapshot } from "./types";
import { emptyWorkspace, validateWorkspace } from "./workspace-data";
export interface WorkspacePersistence {
  load: () => Promise<{ revision: number; data: WorkspaceData } | undefined>;
  save: (data: WorkspaceData, expectedRevision: number) => Promise<number>;
}
export class WorkspaceStore {
  private storage: WorkspacePersistence;
  private revision = 0;
  private loading: Promise<void> | undefined;
  private writes: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private state: WorkspaceSnapshot = {
    ready: false,
    updating: false,
    data: emptyWorkspace(),
    pendingWrites: 0,
    error: "",
    connection: "Not connected",
  };
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
  private emit = () => {
    for (const listener of this.listeners) listener();
  };
  private publish = (patch: Partial<WorkspaceSnapshot>) => {
    this.state = { ...this.state, ...patch };
    this.emit();
  };
  start = () => {
    this.loading ??= this.load();
    return this.loading;
  };
  private load = async () => {
    try {
      const record = await this.storage.load();
      this.revision = record?.revision ?? 0;
      this.publish({ data: record?.data ?? emptyWorkspace(), ready: true });
    } catch (error) {
      this.publish({
        error:
          error instanceof Error ? error.message : "Workspace could not load.",
      });
    }
  };
  change = (update: (data: WorkspaceData) => void) => {
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
  prepareUpdate = async () => {
    this.publish({ updating: true });
    const release = () => {
      return this.publish({ updating: false });
    };
    try {
      await this.flush();
      return release;
    } catch (error) {
      release();
      throw error;
    }
  };
  setConnection = (connection: string) => {
    return this.publish({ connection });
  };
  recover = () => {
    return JSON.stringify(
      {
        format: "ROMDexWebRecovery/1",
        exportedAt: new Date().toISOString(),
        data: this.state.data,
      },
      null,
      2,
    );
  };
}
export const workspaceStore = new WorkspaceStore();
