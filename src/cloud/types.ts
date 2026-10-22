import type {
  TaskItem,
  TaskOperation,
  TaskPatch,
  WorkspaceData,
} from "@/domain/types";
export interface DeliveryRecord {
  status: "attempting" | "uncertain" | "conflict" | "confirmed" | "ready";
  message: string;
  remoteId?: string;
  targetId?: string;
  deletedIds?: string[];
  deleteReceipts?: string[];
  remoteTasks?: TaskItem[];
  archivedOperation?: TaskOperation;
  remote?: TaskItem;
  conflicts?: {
    field: string;
    base: unknown;
    local: unknown;
    remote: unknown;
  }[];
}
export interface CloudData {
  accountId?: string;
  autoSync: boolean;
  records: Record<string, DeliveryRecord>;
}
export interface DeliveryPort {
  accountId: string;
  get: (id: string) => Promise<TaskItem | null>;
  update: (id: string, patch: TaskPatch, expected?: TaskItem) => Promise<void>;
  comment: (id: string, text: string) => Promise<{ id: string }>;
  prepareCreate: (item: TaskItem) => Promise<void>;
  create: (item: TaskItem) => Promise<{ id: string }>;
  remove: (id: string) => Promise<void>;
  children: (id: string) => Promise<string[]>;
}
export type Commit = (update: (data: WorkspaceData) => void) => Promise<void>;
export const cloudData = (data: WorkspaceData): CloudData => {
  return data.cloud ?? { autoSync: false, records: {} };
};
