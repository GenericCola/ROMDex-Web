import { reconcile } from "@/domain/accepted/core.mjs";
import type { TaskItem, TaskPatch, WorkspaceData } from "@/domain/types";
import { equal, replaceRemote, supported } from "./delivery-helpers";
import type { Commit, DeliveryPort } from "./types";
import { cloudData } from "./types";
import { validateQueue } from "./validation";
export const deliverQueue = async (
  snapshot: () => WorkspaceData,
  commit: Commit,
  port: DeliveryPort,
) => {
  validateQueue(snapshot());
  const binding = cloudData(snapshot()).accountId;
  if (binding && binding !== port.accountId)
    throw Error("This browser queue belongs to a different YouTrack account.");
  await commit((data) => {
    data.cloud = { ...cloudData(data), accountId: port.accountId };
  });
  const operations = structuredClone(snapshot().operations);
  for (const operation of operations) {
    const record = cloudData(snapshot()).records[operation.opId];
    if (record?.status === "attempting" || record?.status === "uncertain")
      throw Error(
        "An earlier request has an uncertain result. Review it before sending more changes.",
      );
    if (record?.status === "conflict")
      throw Error("Review the conflicting operation before continuing.");
    if (
      !/^PMON-\d+$/.test(operation.issueId) ||
      operation.type === "create" ||
      operation.type === "delete" ||
      (operation.type === "edit" && !supported(operation.patch))
    )
      throw Error(
        "This operation needs the next delivery adapter (creation, deletion, hierarchy or assigned status). It remains queued; nothing was sent for it.",
      );
    const remote = await port.get(operation.issueId);
    if (!remote)
      throw Error(
        "A queued task is no longer readable. Nothing was sent for it.",
      );
    let patch: TaskPatch = {};
    if (operation.type === "edit") {
      const result = reconcile(operation.base, operation.patch, remote);
      ({ patch } = result);
      if (result.conflicts.length) {
        await commit((data) => {
          data.cloud = {
            ...cloudData(data),
            records: {
              ...cloudData(data).records,
              [operation.opId]: {
                status: "conflict",
                message: "Both browser and YouTrack changed these fields.",
                remote,
                conflicts: result.conflicts,
              },
            },
          };
        });
        throw Error("Review conflicting edits. Both versions were preserved.");
      }
      if (!Object.keys(patch).length) {
        await commit((data) => {
          replaceRemote(data, remote);
          data.operations = data.operations.filter((op) => {
            return op.opId !== operation.opId;
          });
        });
        continue;
      }
    }
    // This transaction must commit before any network write. A crash then requires review, never replay.
    await commit((data) => {
      data.cloud = {
        ...cloudData(data),
        records: {
          ...cloudData(data).records,
          [operation.opId]: {
            status: "attempting",
            message: "Request may have reached YouTrack.",
          },
        },
      };
    });
    let remoteId: string | undefined;
    try {
      if (operation.type === "edit")
        await port.update(operation.issueId, patch);
      else
        remoteId = (await port.comment(operation.issueId, operation.text)).id;
      if (operation.type === "comment" && !remoteId)
        throw Error("Missing comment receipt");
      const verified = await port.get(operation.issueId);
      if (!verified) throw Error("Readback unavailable");
      if (
        operation.type === "edit" &&
        !Object.entries(patch).every(([key, value]) => {
          return equal(verified[key as keyof TaskItem], value);
        })
      )
        throw Error("Readback differs");
      await commit((data) => {
        replaceRemote(data, verified);
        data.operations = data.operations.filter((op) => {
          return op.opId !== operation.opId;
        });
        data.cloud = {
          ...cloudData(data),
          records: {
            ...cloudData(data).records,
            [operation.opId]: {
              status: "confirmed",
              message:
                "YouTrack accepted the change and the task was read back.",
              ...(remoteId ? { remoteId } : {}),
            },
          },
        };
      });
    } catch {
      await commit((data) => {
        data.cloud = {
          ...cloudData(data),
          records: {
            ...cloudData(data).records,
            [operation.opId]: {
              status: "uncertain",
              message:
                "Delivery or confirmation was interrupted. Do not resend without review.",
              ...(remoteId ? { remoteId } : {}),
            },
          },
        };
      });
      throw Error(
        "The delivery result is uncertain. Your queued change is preserved for review.",
      );
    }
  }
};
