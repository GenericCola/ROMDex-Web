import type { AttachmentPort } from "@/attachments/types";
import type {
  TaskItem,
  TaskOperation,
  TaskPatch,
  WorkspaceData,
} from "@/domain/types";
import type {
  SharedStatusPort,
  SharedStatusWrite,
} from "./shared-status-types";
export interface DeliveryRecord {
  tagSteps?: import("./tag-types").TagStep[];
  metadataWrite?: SharedStatusWrite;
  attachmentBeforeIds?: string[];
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
export interface AssignedStatus {
  assignedState: string;
  lastState: string;
  lastUpdated: number | null;
  pendingState: string | null;
}
export interface CloudData {
  sharedStatuses?: boolean;
  assigned?: Record<string, AssignedStatus>;
  rollupPending?: boolean;
  accountId?: string;
  autoSync: boolean;
  records: Record<string, DeliveryRecord>;
}
export interface DeliveryPort {
  tags?: import("./tag-types").TagPort;
  files?: AttachmentPort;
  metadata?: SharedStatusPort;
  accountId: string;
  all: () => Promise<TaskItem[]>;
  get: (id: string) => Promise<TaskItem | null>;
  deletionState?: (
    id: string,
  ) => Promise<{ item: TaskItem | null; gone: boolean }>;
  prepareUpdate?: (
    id: string,
    patch: TaskPatch,
    expected: TaskItem,
  ) => Promise<void>;
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
