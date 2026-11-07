export type Obj = Record<string, unknown>;

export const isObject = (value: unknown): value is Obj => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

export const hasId = (value: unknown): value is Obj & { id: string } => {
  return isObject(value) && typeof value.id === "string";
};

export const isIdList = (value: unknown): value is (Obj & { id: string })[] => {
  return (
    Array.isArray(value) &&
    value.every(hasId) &&
    new Set(
      value.map((entry) => {
        return entry.id;
      }),
    ).size === value.length
  );
};

export const text = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

export const compareText = (a: string, b: string): number => {
  return a < b ? -1 : a > b ? 1 : 0;
};

/** Sort by a string field ascending (missing last), ties by id. */
export const sortByField = (entries: unknown[], field: string): unknown[] => {
  const idOf = (entry: unknown): string => {
    return isObject(entry) ? (text(entry.id) ?? "") : "";
  };
  const stamp = (entry: unknown): string | undefined => {
    return isObject(entry) ? text(entry[field]) : undefined;
  };
  return [...entries].sort((a, b) => {
    const x = stamp(a);
    const y = stamp(b);
    if (x !== y) {
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return compareText(x, y);
    }
    return compareText(idOf(a), idOf(b));
  });
};
