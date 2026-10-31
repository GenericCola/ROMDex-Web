import type { Attachment, AttachmentOperation } from "@/attachments/types";
import type { SharedStatus } from "@/cloud/shared-status-types";
import type { CloudData } from "@/cloud/types";
import type { MigrationRecord } from "@/migration/types";
import type { NpcdexDraft, NpcdexTarget } from "@/npcdex/model";
import type { PlanLedger } from "@/rdx/plan-ledger";
import type { RdxFile } from "@/rdx/types";
import type { JsonObject } from "./json";
export type LampColor =
  "grey" | "yellow" | "blue" | "purple" | "amber" | "green" | "red";
export interface TaskComment {
  id: string;
  text: string;
  author: string;
  created: number;
}
export interface TaskItem {
  [key: `custom:${string}`]: import("./json").JsonValue;
  _custom?: JsonObject[];
  assignee?: string | string[] | null;
  dueDate?: string | null;
  tags?: string[];
  tagNames?: { id: string; name: string }[];
  assignees?: { id: string; name: string }[];
  id: string;
  dbId?: string;
  summary: string;
  description: string;
  parentId: string | null;
  state: string;
  assignedState?: string;
  sharedStatus?: SharedStatus;
  priority: string;
  complexity: string | null;
  type: string;
  updated: number | null;
  comments: TaskComment[];
  commentCount: number;
  url?: string;
}
export type TaskPatch = Partial<
  Pick<
    TaskItem,
    | "summary"
    | "description"
    | "parentId"
    | "state"
    | "assignedState"
    | "priority"
    | "complexity"
    | "assignee"
    | "dueDate"
    | "tags"
  >
> & { [key: `custom:${string}`]: import("./json").JsonValue };
export type TaskOperation =
  | AttachmentOperation
  | { opId: string; type: "create"; issueId: string; item: TaskItem }
  | {
      opId: string;
      type: "edit";
      issueId: string;
      purpose?: "rollup";
      base: TaskItem;
      patch: TaskPatch;
    }
  | {
      opId: string;
      type: "comment";
      issueId: string;
      text: string;
      created: number;
    }
  | {
      opId: string;
      type: "delete";
      issueId: string;
      ids: string[];
      bases?: Record<string, TaskItem>;
    };
export type DetailsMode = "default" | "expanded" | "collapsed";
export interface WorkspaceData {
  schemaVersion: 1;
  hierarchyRecovery?: JsonObject[];
  attachmentLists?: Record<string, Attachment[]>;
  rdxFiles?: RdxFile[];
  rdxImports?: Record<string, PlanLedger>;
  editorRecovery?: JsonObject[];
  images?: Record<string, string>;
  npcdex?: JsonObject;
  npcdexDrafts?: Record<string, NpcdexDraft>;
  npcdexHistory?: JsonObject[];
  migration?: MigrationRecord;
  cloud?: CloudData;
  newTask: {
    title: string;
    parentId: string | null;
    afterId?: string | null;
  } | null;
  titleDrafts: Record<string, string>;
  remote: TaskItem[];
  operations: TaskOperation[];
  order: Record<string, number>;
  commentDrafts: Record<string, string>;
  view: {
    workspace: "romdex" | "npcdex";
    npcdex?: { target: NpcdexTarget; gender: string; stage: string };
    scope: string | null;
    selected: string | null;
    renameId?: string | null;
    search: string;
    hideCompleted: boolean;
    expanded: string[];
    selectorExpanded: string[];
    detailsMode: DetailsMode;
    workHeight: number;
    automaticTrayHeight?: boolean;
  };
}
export interface WorkspaceSnapshot {
  ready: boolean;
  updating: boolean;
  delivering: boolean;
  data: WorkspaceData;
  pendingWrites: number;
  error: string;
  connection: string;
}
