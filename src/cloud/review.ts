import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { abandonCreation } from "./abandon-creation";
import { observeStatus } from "./assigned-status";
import { completeCreation, matchesCreation } from "./creation";
import { replaceRemote } from "./delivery-helpers";
import { acknowledge } from "./journal";
import { rebaseEdit } from "./rebase-edit";
import { reviewDeletion } from "./review-deletion";
import { confirmEdit, reviewedEdit } from "./review-edit";
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
  const copy = structuredClone(data);
  const remote = observeStatus(copy, received);
  await commit((next) => {
    next.cloud = cloudData(copy);
  });
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
    if (operation.type === "edit") confirmEdit(operation, remote);
    else
      await port.verifyComment(
        operation.issueId,
        cloudData(data).records[opId]?.remoteId ?? receipt,
        operation.text,
      );
  }
  if (
    choice === "local" &&
    (operation.type !== "edit" || operation.purpose === "rollup")
  )
    throw Error("Only an edit can be rebased after readback.");
  await commit((next) => {
    replaceRemote(
      next,
      operation.type === "edit"
        ? reviewedEdit(next, operation, remote, choice === "confirm")
        : remote,
    );
    if (choice === "local") rebaseEdit(next, opId, remote);
    else acknowledge(next, operation);
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
