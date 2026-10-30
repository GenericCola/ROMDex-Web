import type { JsonObject } from "../json";
import type { TaskItem, TaskOperation, TaskPatch } from "../types";
export interface ItemEditorHost {
  state: { editOptions: JsonObject | null; operations?: TaskOperation[] };
  items: TaskItem[];
  connected: boolean;
  edit: (id: string, patch: TaskPatch, base: JsonObject) => Promise<void>;
  loadEditOptions: (
    id: string,
  ) => Promise<{ options: JsonObject; item: TaskItem | null }>;
}
export class ItemEditor {
  constructor(options: {
    ws: ItemEditorHost;
    esc: (value: unknown) => string;
    onSaved: (count: number) => void;
  });
  open(
    item: TaskItem,
    options?: { displayStatus: string; parent: boolean },
  ): Promise<void>;
  collect(): JsonObject;
  hasUnsavedChanges(): boolean;
  saving: boolean;
  session: { id: string } | null;
}
