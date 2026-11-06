// Multi-store IndexedDB fake (the shared fixture keeps one map per database).
export const storeIndexedDb = (): IDBFactory => {
  const databases = new Map<string, Map<string, Map<unknown, unknown>>>();
  const counters = new Map<string, number>();
  return {
    open(name: string) {
      const stores = databases.get(name) ?? new Map();
      const fresh = !databases.has(name);
      databases.set(name, stores);
      const db = {
        close() {},
        createObjectStore(
          store: string,
          options?: { autoIncrement?: boolean },
        ) {
          stores.set(store, new Map());
          if (options?.autoIncrement) counters.set(`${name}/${store}`, 0);
        },
        transaction(store: string) {
          const tx = {
            oncomplete: undefined as (() => void) | undefined,
            onabort: undefined as (() => void) | undefined,
            objectStore() {
              const map = stores.get(store) ?? new Map();
              const request = (result: unknown) => {
                const req = { result, onsuccess: undefined };
                queueMicrotask(() => {
                  queueMicrotask(() => tx.oncomplete?.());
                });
                return req;
              };
              return {
                get: (key: unknown) => request(structuredClone(map.get(key))),
                getAll: () => request(structuredClone([...map.values()])),
                put: (value: unknown, key: unknown) => {
                  map.set(key, structuredClone(value));
                  return request(key);
                },
                add: (value: unknown) => {
                  const id = `${name}/${store}`;
                  const next = (counters.get(id) ?? 0) + 1;
                  counters.set(id, next);
                  map.set(next, structuredClone(value));
                  return request(next);
                },
              };
            },
          };
          return tx;
        },
      };
      const opened: {
        result: unknown;
        onupgradeneeded?: () => void;
        onsuccess?: () => void;
      } = { result: db };
      queueMicrotask(() => {
        if (fresh) opened.onupgradeneeded?.();
        opened.onsuccess?.();
      });
      return opened;
    },
  } as unknown as IDBFactory;
};
