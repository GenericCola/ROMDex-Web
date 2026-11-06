// Returns `next`, reusing `previous` objects and arrays wherever their content
// is identical, so unchanged parts of a workspace keep their identity across
// saves. Nothing is allocated for identical subtrees. Callers must treat both
// values as immutable.
type Value = unknown;
type Plain = Record<string, Value> | Value[];
const plain = (value: Value): value is Plain => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return true;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
const shareArray = (previous: Value[], next: Value[]) => {
  let shared: Value[] | undefined =
    previous.length === next.length ? undefined : [];
  for (let index = 0; index < next.length; index++) {
    const value = shareStructure(previous[index], next[index]);
    if (!shared && value !== previous[index]) shared = previous.slice(0, index);
    shared?.push(value);
  }
  return shared ?? previous;
};
const shareRecord = (
  previous: Record<string, Value>,
  next: Record<string, Value>,
) => {
  const previousKeys = Object.keys(previous),
    nextKeys = Object.keys(next);
  let entries: [string, Value][] | undefined =
    previousKeys.length === nextKeys.length ? undefined : [];
  for (let index = 0; index < nextKeys.length; index++) {
    const key = nextKeys[index] ?? "";
    const value = Object.hasOwn(previous, key)
      ? shareStructure(previous[key], next[key])
      : next[key];
    if (!entries && (previousKeys[index] !== key || value !== previous[key]))
      entries = nextKeys.slice(0, index).map((earlier): [string, Value] => {
        return [earlier, previous[earlier]];
      });
    entries?.push([key, value]);
  }
  // fromEntries defines own data properties, so a "__proto__" key stays data.
  return entries ? Object.fromEntries(entries) : previous;
};
export const shareStructure = <T>(previous: Value, next: T): T => {
  if (Object.is(previous, next) || !plain(previous) || !plain(next))
    return next;
  if (Array.isArray(previous) !== Array.isArray(next)) return next;
  return (
    Array.isArray(previous)
      ? shareArray(previous, next as Value[])
      : shareRecord(previous, next as Record<string, Value>)
  ) as T;
};
