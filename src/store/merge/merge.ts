export type FlatValues = Record<string, unknown>;
export interface MergeConflict {
  key: string;
  base?: unknown;
  local?: unknown;
  remote?: unknown;
}
export interface MergeResult {
  merged: FlatValues;
  conflicts: MergeConflict[];
  toRemote: string[];
  toLocal: string[];
}

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => {
          return [key, sortKeys(source[key])];
        }),
    );
  }
  return value;
};

/** JSON text with recursively sorted object keys, so equal values compare equal. */
export const stableJson = (value: unknown): string => {
  return JSON.stringify(sortKeys(value));
};

export const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === undefined || b === undefined) return a === b;
  return stableJson(a) === stableJson(b);
};

const valueAt = (flat: FlatValues, key: string): unknown => {
  return Object.hasOwn(flat, key) ? flat[key] : undefined;
};

const byKey = (a: string, b: string): number => {
  return a < b ? -1 : a > b ? 1 : 0;
};

/** Three-way merge of flat JSON maps. Conflicts keep the remote value. */
export const mergeValues = (
  base: FlatValues | null,
  local: FlatValues,
  remote: FlatValues,
): MergeResult => {
  const keys = [
    ...new Set([
      ...Object.keys(base ?? {}),
      ...Object.keys(local),
      ...Object.keys(remote),
    ]),
  ].sort(byKey);
  const merged: FlatValues = {};
  const conflicts: MergeConflict[] = [];
  const toRemote: string[] = [];
  const toLocal: string[] = [];
  for (const key of keys) {
    const l = valueAt(local, key);
    const r = valueAt(remote, key);
    let chosen: unknown;
    if (base === null) chosen = r !== undefined ? r : l;
    else {
      const b = valueAt(base, key);
      if (sameValue(l, b)) chosen = r;
      else if (sameValue(r, b)) chosen = l;
      else if (sameValue(l, r)) chosen = l;
      else {
        chosen = r;
        const conflict: MergeConflict = { key };
        if (b !== undefined) conflict.base = b;
        if (l !== undefined) conflict.local = l;
        if (r !== undefined) conflict.remote = r;
        conflicts.push(conflict);
      }
    }
    if (chosen !== undefined) merged[key] = chosen;
    if (!sameValue(chosen, r)) toRemote.push(key);
    if (!sameValue(chosen, l)) toLocal.push(key);
  }
  return { merged, conflicts, toRemote, toLocal };
};
