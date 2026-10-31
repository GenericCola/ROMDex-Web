import type { TaskOperation, WorkspaceData } from "@/domain/types";
export const creationDependency = (
  data: WorkspaceData,
  first = data.operations[0],
): string | undefined => {
  if (first?.type !== "create") return undefined;
  let operation: Extract<TaskOperation, { type: "create" }> = first;
  const seen = new Set([operation.issueId]);
  while (true) {
    const { parentId } = operation.item;
    if (!parentId?.startsWith("local-")) break;
    if (seen.has(parentId))
      throw Error("Queued creation contains a parent cycle.");
    seen.add(parentId);
    const parent: TaskOperation | undefined = data.operations.find((op) => {
      return op.type === "create" && op.issueId === parentId;
    });
    if (parent?.type !== "create")
      throw Error(
        "A local creation parent has no queued creation. Review its recovery data.",
      );
    operation = parent;
  }
  return operation.opId;
};
