export const isFileDrag: (transfer: Pick<DataTransfer, "types"> | null) => boolean;
export const droppedFiles: (transfer: Pick<DataTransfer, "types" | "files" | "items">) => File[];
export class FileDropTarget {
  constructor(options: { doc: Document; attach: (id: string, files: File[]) => Promise<unknown[]>; item: (id: string) => { id: string; summary: string } | undefined; notify: (message: string) => void; internalDrag?: () => boolean; suppressClick?: () => void });
  feedback: HTMLElement;
  busy: boolean;
  dispose(): void;
}
