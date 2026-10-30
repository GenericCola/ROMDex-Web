import assert from "node:assert/strict";
import type { DeliveryPort } from "../../src/cloud/types";
import type { TaskItem } from "../../src/domain/types";
export const navigationPort = (items: TaskItem[]) => {
  const remote = new Map(
    items.map((item) => {
      return [item.id, structuredClone(item)];
    }),
  );
  const sent: string[] = [];
  const forbidden = (): Promise<never> => {
    return Promise.reject(Error("Unexpected fixture mutation"));
  };
  const port: DeliveryPort = {
    accountId: "synthetic-owner",
    all: () => {
      return Promise.resolve(structuredClone([...remote.values()]));
    },
    get: (id) => {
      return Promise.resolve(structuredClone(remote.get(id) ?? null));
    },
    children: (id) => {
      return Promise.resolve(
        [...remote.values()]
          .filter((item) => {
            return item.parentId === id;
          })
          .map((item) => {
            return item.id;
          }),
      );
    },
    update: (id, patch) => {
      const item = remote.get(id);
      assert.ok(item);
      sent.push(id);
      Object.assign(item, patch);
      return Promise.resolve();
    },
    prepareCreate: () => {
      return Promise.resolve();
    },
    create: forbidden,
    remove: forbidden,
    comment: forbidden,
  };
  return { port, remote, sent };
};
