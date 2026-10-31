import type { TaskItem, WorkspaceData } from "@/domain/types";
export const queueRollup = (
  data: WorkspaceData,
  item: TaskItem,
  state: string,
) => {
  if (
    data.operations.some((op) => {
      return (
        op.type === "edit" && op.purpose === "rollup" && op.issueId === item.id
      );
    })
  )
    return undefined;
  const opId = crypto.randomUUID();
  data.operations.push({
    opId,
    type: "edit",
    purpose: "rollup",
    issueId: item.id,
    base: item,
    patch: { state, assignedState: item.assignedState ?? item.state },
  });
  return opId;
};
