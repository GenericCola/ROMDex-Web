import type { SharedStatus } from "@/cloud/shared-status-types";
import type { CloudData } from "@/cloud/types";
import type { MigrationRecord } from "@/migration/types";
import type { NpcdexDraft, NpcdexTarget } from "@/npcdex/model";
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
  >
>;
export type TaskOperation =
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
  rdxFiles?: RdxFile[];
  editorRecovery?: JsonObject[];
  images?: Record<string, string>;
  npcdex?: JsonObject;
  npcdexDrafts?: Record<string, NpcdexDraft>;
  npcdexHistory?: JsonObject[];
  migration?: MigrationRecord;
  cloud?: CloudData;
  newTask: { title: string; parentId: string | null } | null;
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
    search: string;
    hideCompleted: boolean;
    expanded: string[];
    selectorExpanded: string[];
    detailsMode: DetailsMode;
    workHeight: number;
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
