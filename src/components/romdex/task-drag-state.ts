import type { DropIntent } from "@/domain/task-drop";
export interface Drag {
  id: string;
  bulkIds?: string[];
  x: number;
  y: number;
  pointer: number;
  signature: string;
  active: boolean;
  intent: DropIntent | null;
}
