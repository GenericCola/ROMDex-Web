const text = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
class StatusError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (code, message) => {
  throw new StatusError(code, message);
};
const expected = (value) =>
  object(value) &&
  Number.isSafeInteger(value.revision) &&
  value.revision >= 0 &&
  typeof value.initialized === "boolean" &&
  (value.initialized ? value.revision > 0 : value.revision === 0) &&
  text(value.assignedState) &&
  text(value.state) &&
  (value.initialized || value.assignedState === value.state) &&
  Number.isSafeInteger(value.updated) &&
  value.updated >= 0;
const request = (value) =>
  object(value) &&
  value.schema === 1 &&
  text(value.opId) &&
  ["assign", "rollup"].includes(value.kind) &&
  text(value.value) &&
  expected(value.expected);
const load = (issue) => {
  const value = issue.extensionProperties.assignedStatus;
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 10000)
    fail(422, "Invalid assigned-status storage.");
  let record;
  try {
    record = JSON.parse(value);
  } catch {
    fail(422, "Invalid assigned-status storage.");
  }
  if (
    !object(record) ||
    record.schema !== 1 ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    !text(record.assignedState) ||
    !text(record.lastState) ||
    !request(record.receipt) ||
    record.revision !== record.receipt.expected.revision + 1 ||
    record.assignedState !==
      (record.receipt.kind === "assign"
        ? record.receipt.value
        : record.receipt.expected.assignedState) ||
    record.lastState !==
      (record.receipt.kind === "rollup"
        ? record.receipt.value
        : record.receipt.expected.state)
  )
    fail(422, "Unsupported assigned-status storage.");
  return record;
};
const snapshot = (issue, record) => {
  const state = issue.fields.State?.name;
  if (!text(state) || !Number.isSafeInteger(issue.updated) || issue.updated < 0)
    fail(422, "State or task revision is unreadable.");
  return {
    schema: 1,
    id: issue.id,
    revision: record?.revision ?? 0,
    initialized: !!record,
    assignedState:
      record && state === record.lastState ? record.assignedState : state,
    state,
    updated: issue.updated,
    receipt: record?.receipt ?? null,
  };
};
const base = (snapshot) => ({
  revision: snapshot.revision,
  initialized: snapshot.initialized,
  assignedState: snapshot.assignedState,
  state: snapshot.state,
  updated: snapshot.updated,
});
const sameRequest = (a, b) =>
  a.schema === b.schema &&
  a.opId === b.opId &&
  a.kind === b.kind &&
  a.value === b.value &&
  expected(a.expected) &&
  expected(b.expected) &&
  Object.keys(base(a.expected)).every(
    (key) => a.expected[key] === b.expected[key],
  );
Object.assign(exports, {
  StatusError,
  text,
  fail,
  load,
  snapshot,
  base,
  request,
  sameRequest,
});
