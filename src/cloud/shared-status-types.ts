export interface SharedStatusBase {
  revision: number;
  initialized: boolean;
  assignedState: string;
  state: string;
  updated: number;
}
export interface SharedStatusWrite {
  schema: 1;
  opId: string;
  kind: "assign" | "rollup";
  value: string;
  expected: SharedStatusBase;
}
export interface SharedStatus extends SharedStatusBase {
  schema: 1;
  id: string;
  receipt: SharedStatusWrite | null;
}
export interface SharedStatusPort {
  probe: () => Promise<void>;
  get: (id: string) => Promise<SharedStatus>;
  write: (id: string, body: SharedStatusWrite) => Promise<void>;
}
