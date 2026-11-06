import { materialize } from "@/domain/accepted/core.mjs";
import type { WorkspaceData } from "@/domain/types";
import { captureOrders, projectOrders } from "@/store/merge";

const PREFIX = "orders/";

const isIdList = (value: unknown): value is string[] => {
  return (
    Array.isArray(value) &&
    value.every((id) => {
      return typeof id === "string";
    })
  );
};

/** True while the tree shape may change (create, delete or move waiting to be delivered). */
export const hierarchyPending = (data: WorkspaceData): boolean => {
  return data.operations.some((operation) => {
    return (
      operation.type === "create" ||
      operation.type === "delete" ||
      (operation.type === "edit" && Object.hasOwn(operation.patch, "parentId"))
    );
  });
};

const orderEntries = (values: Record<string, unknown> | null) => {
  return Object.entries(values ?? {}).filter(([key]) => {
    return key.startsWith(PREFIX);
  });
};

/** Every captured id is in the base list and the shared ids keep their relative order. */
const sameRelativeOrder = (list: string[], captured: string[]): boolean => {
  if (
    !captured.every((id) => {
      return list.includes(id);
    })
  )
    return false;
  const common = list.filter((id) => {
    return captured.includes(id);
  });
  return common.every((id, index) => {
    return id === captured[index];
  });
};

export const localOrders = (
  data: WorkspaceData,
  base: Record<string, unknown> | null,
  remote: Record<string, unknown>,
): Record<string, unknown> => {
  // Lists to compare with: a browser that never synced compares with YouTrack's.
  const source = base ?? remote;
  // Carried unchanged only from a base: with none, the merge already takes
  // YouTrack's values, and carrying them would hide them from this browser.
  const out: Record<string, unknown> = Object.fromEntries(orderEntries(base));
  if (hierarchyPending(data)) return out;
  const items = materialize(data.remote, data.operations);
  const known = new Set(
    items.map((item) => {
      return item.id;
    }),
  );
  for (const [parent, captured] of Object.entries(
    captureOrders(items, data.order),
  )) {
    const key = `${PREFIX}${parent}`;
    const list = source[key];
    out[key] =
      isIdList(list) && sameRelativeOrder(list, captured)
        ? list
        : [
            ...captured,
            ...(isIdList(list)
              ? list.filter((id) => {
                  return !known.has(id);
                })
              : []),
          ];
  }
  return out;
};

export const applyOrders = (
  data: WorkspaceData,
  values: Record<string, unknown>,
  keys: string[],
): string[] => {
  const mine = keys.filter((key) => {
    return key.startsWith(PREFIX);
  });
  if (hierarchyPending(data)) return mine;
  const docOrders: Record<string, string[]> = {};
  const previous: Record<string, string[]> = {};
  for (const key of mine) {
    const parent = key.slice(PREFIX.length);
    const value = values[key];
    if (isIdList(value)) docOrders[parent] = value;
    else if (!Object.hasOwn(values, key)) previous[parent] = [];
  }
  data.order = projectOrders(
    docOrders,
    materialize(data.remote, data.operations),
    data.order,
    previous,
  );
  return [];
};
