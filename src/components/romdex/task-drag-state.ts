import type { DropIntent } from "@/domain/task-drop";
export interface Drag {
  id: string;
  capture?: HTMLElement;
  bulkIds?: string[];
  x: number;
  y: number;
  pointer: number;
  signature: string;
  active: boolean;
  intent: DropIntent | null;
}
