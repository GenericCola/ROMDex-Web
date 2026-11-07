/** A Map-backed Storage stand-in; `values` is exposed for inspection. */
export const memoryStorage = (
  initial: Iterable<readonly [string, string]> = [],
) => {
  const values = new Map<string, string>(initial);
  return {
    values,
    getItem: (key: string) => {
      return values.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
};
