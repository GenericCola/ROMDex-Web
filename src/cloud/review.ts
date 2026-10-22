import type { TaskItem, WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { abandonCreation } from "./abandon-creation";
import { completeCreation, matchesCreation } from "./creation";
import { equal, replaceRemote } from "./delivery-helpers";
import { acknowledge } from "./journal";
import { reviewDeletion } from "./review-deletion";
import { requireDelivery } from "./session";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
type ReviewPort = DeliveryPort & {
  verifyComment: (id: string, receipt: string, text: string) => Promise<void>;
};
export const reviewQueue = async (
  data: WorkspaceData,
  commit: Commit,
  port: ReviewPort,
  opId: string,
  choice: "cloud" | "local" | "confirm",
  receipt = "",
  missingAcknowledged = false,
) => {
  if (cloudData(data).accountId !== port.accountId)
    throw Error("The queue belongs to a different account.");
  const operation = data.operations.find((op) => {
    return op.opId === opId;
  });
  if (!operation || !cloudData(data).records[opId])
    throw Error("Operation no longer awaiting review.");
  if (operation.type === "delete")
    return reviewDeletion(
      data,
      operation,
      choice,
      commit,
      port,
      missingAcknowledged,
    );
  if (operation.type === "create" && choice === "cloud") {
    await commit((next) => {
      abandonCreation(next, opId);
    });
    return;
  }
  const id =
    operation.type === "create"
      ? (cloudData(data).records[opId]?.remoteId ?? receipt)
      : operation.issueId;
  if (!id || !/^PMON-\d+$/.test(id))
    throw Error(
      "Enter the exact created YouTrack issue ID (PMON-number). No creation will be resent.",
    );
  const received = await port.get(id);
  if (!received)
    throw Error(
      "The task is not readable; preserve recovery and resolve access first.",
    );
  const remote = {
    ...received,
    assignedState: received.assignedState ?? received.state,
  };
  if (operation.type === "create") {
    if (choice !== "confirm" || !matchesCreation(operation.item, remote))
      throw Error(
        "The exact cloud task does not match the queued creation. Nothing was sent.",
      );
    await commit((next) => {
      completeCreation(next, operation, remote);
    });
    return;
  }
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
    } else
      await port.verifyComment(
        operation.issueId,
        cloudData(data).records[opId]?.remoteId ?? receipt,
        operation.text,
      );
  }
  if (choice === "local" && operation.type !== "edit")
    throw Error("Only an edit can be rebased after readback.");
  await commit((next) => {
    replaceRemote(next, remote);
    if (choice === "local") {
      const queued = next.operations.find((op) => {
        return op.opId === opId;
      });
      if (queued?.type === "edit") queued.base = remote;
      const cloud = cloudData(next);
      delete cloud.records[opId];
      next.cloud = cloud;
    } else acknowledge(next, operation);
  });
};
export const reviewDelivery = async (
  opId: string,
  choice: "cloud" | "local" | "confirm",
  receipt = "",
  missingAcknowledged = false,
) => {
  const port = requireDelivery();
  await workspaceStore.deliver(async (commit) => {
    await reviewQueue(
      workspaceStore.getSnapshot().data,
      commit,
      port,
      opId,
      choice,
      receipt,
      missingAcknowledged,
    );
  });
};
