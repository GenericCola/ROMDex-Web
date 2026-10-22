import type { TaskItem } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { equal, replaceRemote } from "./delivery-helpers";
import { requireDelivery } from "./session";
import { cloudData } from "./types";
export const reviewDelivery = async (
  opId: string,
  choice: "cloud" | "local" | "confirm",
  commentId = "",
) => {
  const port = requireDelivery();
  await workspaceStore.deliver(async (commit) => {
    const { data } = workspaceStore.getSnapshot();
    const operation = data.operations.find((op) => {
      return op.opId === opId;
    });
    if (!operation) throw Error("Operation no longer pending.");
    const remote = await port.get(operation.issueId);
    if (!remote)
      throw Error(
        "The task is not readable; preserve the recovery copy and resolve access first.",
      );
    if (choice === "confirm") {
      if (operation.type === "edit") {
        if (
          !Object.entries(operation.patch).every(([key, value]) => {
            return equal(remote[key as keyof TaskItem], value);
          })
        )
          throw Error(
            "YouTrack does not match the queued change. No retry was sent.",
          );
      } else if (operation.type === "comment") {
        const receipt = cloudData(data).records[opId]?.remoteId ?? commentId;
        await port.verifyComment(operation.issueId, receipt, operation.text);
      } else throw Error("This operation cannot be confirmed by this adapter.");
    }
    if (
      choice === "local" &&
      (operation.type !== "edit" ||
        cloudData(data).records[opId]?.status !== "conflict")
    )
      throw Error(
        "Only reviewed edit conflicts can be rebased. Uncertain requests are never resent automatically.",
      );
    await commit((next) => {
      replaceRemote(next, remote);
      const records = { ...cloudData(next).records };
      if (choice === "local" && operation.type === "edit") {
        const queued = next.operations.find((op) => {
          return op.opId === opId;
        });
        if (queued?.type === "edit") queued.base = remote;
        delete records[opId];
      } else {
        next.operations = next.operations.filter((op) => {
          return op.opId !== opId;
        });
        records[opId] = {
          status: "confirmed",
          message:
            choice === "cloud"
              ? "User kept YouTrack and archived the local operation."
              : "User verified the remote result.",
          archivedOperation: operation,
        };
      }
      next.cloud = { ...cloudData(next), records };
    });
  });
};
