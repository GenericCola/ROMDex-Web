import { ResumeRejected } from "@/auth/resume-failure";
import { workspaceStore } from "@/domain/workspace-store";
import { DeliveryClient } from "@/youtrack/delivery-client";
import { cloudData } from "./types";
export const openDelivery = async (
  token: string,
  expectedUserId: string | undefined,
  assertCurrent: () => void,
) => {
  await workspaceStore.start();
  assertCurrent();
  const opened = workspaceStore.getSnapshot();
  if (!opened.ready || opened.error)
    throw Error(opened.error || "Wait for your workspace to open.");
  const next = new DeliveryClient(token);
  await next.connect();
  assertCurrent();
  if (expectedUserId && next.accountId !== expectedUserId)
    throw new ResumeRejected(
      "The data connection identity differs from the signed-in account.",
    );
  const bound = cloudData(workspaceStore.getSnapshot().data).accountId;
  if (bound && bound !== next.accountId)
    throw Error("The queue is bound to a different account.");
  await workspaceStore.change((data) => {
    data.cloud = { ...cloudData(data), accountId: next.accountId };
  });
  await workspaceStore.flush();
  assertCurrent();
  return next;
};
