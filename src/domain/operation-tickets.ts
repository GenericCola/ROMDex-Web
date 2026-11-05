import type { TaskOperation } from "./types";
export const operationTicketIds = (operation: TaskOperation): Set<string> => {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id != null) {
      if (typeof id !== "string" || !id || id === "*")
        throw Error("Invalid operation ticket identity.");
      ids.add(id);
    }
  };
  if (!operation.issueId || !operation.opId)
    throw Error("Invalid operation ticket identity.");
  add(operation.issueId);
  if (operation.type === "delete") {
    operation.ids.forEach(add);
    for (const item of Object.values(operation.bases ?? {})) {
      add(item.id);
      add(item.parentId);
    }
  } else if (operation.type === "edit" && "parentId" in operation.patch) {
    add(operation.base.parentId);
    add(operation.patch.parentId);
  } else if (operation.type === "create") {
    add(operation.item.id);
    add(operation.item.parentId);
  } else if (
    !["edit", "comment", "attachment", "attachment-delete"].includes(
      operation.type,
    )
  ) {
    throw Error("Invalid operation ticket identity.");
  }
  return ids;
};
