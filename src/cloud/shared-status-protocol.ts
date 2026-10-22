import type { TaskItem } from "@/domain/types";
import type {
  SharedStatus,
  SharedStatusBase,
  SharedStatusWrite,
} from "./shared-status-types";
const object = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};
const text = (value: unknown) => {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
};
export const statusBase = (value: SharedStatusBase): SharedStatusBase => {
  return {
    revision: value.revision,
    initialized: value.initialized,
    assignedState: value.assignedState,
    state: value.state,
    updated: value.updated,
  };
};
const validBase = (value: unknown): value is SharedStatusBase => {
  return (
    object(value) &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) >= 0 &&
    typeof value.initialized === "boolean" &&
    (value.initialized ? Number(value.revision) > 0 : value.revision === 0) &&
    text(value.assignedState) &&
    text(value.state) &&
    (value.initialized || value.assignedState === value.state) &&
    Number.isSafeInteger(value.updated) &&
    Number(value.updated) >= 0
  );
};
export const validateStatusWrite: (
  value: unknown,
) => asserts value is SharedStatusWrite = (value) => {
  if (
    !object(value) ||
    value.schema !== 1 ||
    !text(value.opId) ||
    !["assign", "rollup"].includes(String(value.kind)) ||
    !text(value.value) ||
    !validBase(value.expected)
  )
    throw Error(
      "Invalid shared-status request. Browser recovery data was kept.",
    );
};
export const parseSharedStatus = (value: unknown, id: string): SharedStatus => {
  if (
    !object(value) ||
    value.schema !== 1 ||
    value.id !== id ||
    !/^PMON-\d+$/.test(id) ||
    !validBase(value) ||
    !("receipt" in value)
  )
    throw Error("Invalid shared-status response. Nothing was replaced.");
  if (value.receipt !== null) validateStatusWrite(value.receipt);
  if (
    value.receipt !== null &&
    Number(value.revision) !== Number(value.receipt.expected.revision) + 1
  )
    throw Error("Invalid shared-status receipt revision.");
  if (value.initialized !== (value.receipt !== null))
    throw Error("Invalid shared-status receipt.");
  if (value.receipt) {
    const { receipt } = value;
    const last =
      receipt.kind === "assign" ? receipt.expected.state : receipt.value;
    const assigned =
      receipt.kind === "assign"
        ? receipt.value
        : receipt.expected.assignedState;
    if (value.assignedState !== (value.state === last ? assigned : value.state))
      throw Error("Inconsistent shared-status receipt.");
  }
  return {
    schema: 1,
    id,
    ...statusBase(value),
    receipt: value.receipt,
  };
};
export const attachSharedStatus = (
  item: TaskItem,
  value: unknown,
): TaskItem => {
  const sharedStatus = parseSharedStatus(value, item.id);
  if (
    sharedStatus.state !== item.state ||
    sharedStatus.updated !== item.updated
  )
    throw Error(
      "The task changed during its shared-status read. Refresh before delivery.",
    );
  return { ...item, assignedState: sharedStatus.assignedState, sharedStatus };
};
export const matchesStatusWrite = (
  snapshot: SharedStatus | undefined,
  write: SharedStatusWrite,
) => {
  const receipt = snapshot?.receipt;
  return (
    !!receipt &&
    receipt.schema === write.schema &&
    receipt.opId === write.opId &&
    receipt.kind === write.kind &&
    receipt.value === write.value &&
    JSON.stringify(statusBase(receipt.expected)) ===
      JSON.stringify(statusBase(write.expected))
  );
};
