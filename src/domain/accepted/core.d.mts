import type {
  LampColor,
  TaskItem,
  TaskOperation,
  TaskPatch,
  WorkspaceData,
} from "../types";
export const STATUS: Record<LampColor, string>;
export const STATES: Record<LampColor, string>;
export function youTrackState(value: string): string;
export function statusOf(value: string): LampColor;
export function rollup(colors: LampColor[]): LampColor | null;
export function hasMeaningfulNotes(value: string): boolean;
export function indexTree(
  items: TaskItem[],
  order?: Record<string, number>,
): {
  byId: Map<string, TaskItem>;
  children: Map<string | null, TaskItem[]>;
  depths: Map<string, number>;
  colors: Map<string, LampColor>;
};
export function descendants(items: TaskItem[], id: string): string[];
export function validateMove(
  items: TaskItem[],
  id: string,
  parentId: string | null,
): void;
export function materialize(
  items: TaskItem[],
  operations: TaskOperation[],
): TaskItem[];
export function reconcile(
  base: TaskItem,
  patch: TaskPatch,
  remote: TaskItem | null,
): {
  patch: TaskPatch;
  conflicts: {
    field: string;
    base: unknown;
    local: unknown;
    remote: unknown;
  }[];
};

export function saveNeedsAttention(
  state:
    | {
        operations?: unknown[];
        blocked?: boolean;
        rdxImports?: WorkspaceData["rdxImports"];
      }
    | null
    | undefined,
  connection:
    | {
        connected?: boolean;
        automaticSyncEnabled?: boolean;
        mode?: string;
        failures?: number;
        missingStates?: unknown[];
      }
    | null
    | undefined,
  dirtyFields?: { summary?: boolean; description?: boolean },
): boolean;
