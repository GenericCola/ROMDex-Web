/** Opens an IndexedDB database; any error or blocked open rejects with `failureMessage`. */
export const openDatabase = (
  name: string,
  version: number,
  upgrade: (db: IDBDatabase) => void,
  failureMessage: string,
): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    const upgradeNeeded = () => {
      upgrade(request.result);
    };
    const success = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
    const failure = () => {
      reject(Error(failureMessage));
    };
    request.onupgradeneeded = upgradeNeeded;
    request.onsuccess = success;
    request.onerror = failure;
    request.onblocked = failure;
  });
};
