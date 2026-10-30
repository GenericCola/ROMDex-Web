export class DetailNavigation {
  history: string[];
  reset(): void;
  open(current: string | null, next: string, fromChild?: boolean): void;
  destination(byId: Map<string, unknown>): string | null;
  back(byId: Map<string, unknown>): string | null;
  remap(mapping: Record<string, string>): void;
}
