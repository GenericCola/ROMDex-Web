// Narrow asynchronous fixture for the requests used by scoped persistence tests.
export const memoryIndexedDb = (): IDBFactory => {
  const databases = new Map<string, Map<string, unknown>>();
  return {
    open(name: string) {
      const values = databases.get(name) ?? new Map<string, unknown>();
      databases.set(name, values);
      const opened: { result: unknown; onsuccess?: () => void } = {
        result: {
          close() {},
          transaction() {
            const tx = {
              oncomplete: undefined as (() => void) | undefined,
              onabort: undefined as (() => void) | undefined,
              aborted: false,
              abort() {
                tx.aborted = true;
                tx.onabort?.();
              },
              objectStore() {
                const request = (value: unknown) => {
                  const req = {
                    result: structuredClone(value),
                    onsuccess: undefined as (() => void) | undefined,
                  };
                  queueMicrotask(() => {
                    req.onsuccess?.();
                    queueMicrotask(() => {
                      if (!tx.aborted) tx.oncomplete?.();
                    });
                  });
                  return req;
                };
                return {
                  get(key: IDBValidKey) {
                    return request(values.get(JSON.stringify(key)));
                  },
                  getAll() {
                    return request([...values.values()]);
                  },
                  put(value: unknown, key: IDBValidKey) {
                    values.set(JSON.stringify(key), structuredClone(value));
                  },
                  delete(key: IDBValidKey) {
                    values.delete(JSON.stringify(key));
                    queueMicrotask(() => tx.oncomplete?.());
                  },
                };
              },
            };
            return tx;
          },
        },
      };
      queueMicrotask(() => opened.onsuccess?.());
      return opened;
    },
  } as unknown as IDBFactory;
};
