import { CLOUD_UPLOAD_LIMIT } from "@/attachments/validate";
import { cloudData } from "@/cloud/types";
import { youTrackState } from "@/domain/accepted/core.mjs";
import {
  previewPlanPublication,
  type PublicationRequest,
} from "@/domain/accepted/rdx/plan-publication.mjs";
import { jsonObject, type JsonObject } from "@/domain/json";
import { nativeEditPayload } from "@/youtrack/native-edit-payload";
import { readRdx } from "./container";

// Keep the desktop review rules; never silently drop fields the web writer lacks.
export const previewBrowserPlan = async (
  bytes: Uint8Array,
  request: PublicationRequest,
) => {
  const parsed = await readRdx(bytes);
  if (parsed.document.kind !== "plan")
    throw Error("Use the task plan importer for plans only.");
  const result = previewPlanPublication(parsed, request);
  const blockers = [...(result.preview.blockers as string[])];
  if (
    Object.values(request.state.rdxImports ?? {}).some((ledger) => {
      return (
        !!ledger.review ||
        Object.values(ledger.batches).some((batch) => {
          return batch.status === "needs-review" || batch.status === "blocked";
        })
      );
    })
  )
    blockers.push(
      "Review the existing native plan reconciliation before queuing another batch.",
    );
  for (const value of result.batch.operations as JsonObject[]) {
    const patch =
      value.type === "create"
        ? jsonObject(value.item)
        : value.type === "edit"
          ? jsonObject(value.patch)
          : null;
    if (!patch) continue;
    if (Object.hasOwn(patch, "tags"))
      blockers.push(
        "Native tag publication requires its per-tag delivery adapter.",
      );
    try {
      nativeEditPayload(patch, request.options ?? {});
    } catch (error) {
      blockers.push(
        error instanceof Error
          ? error.message
          : "Native field mapping is unavailable.",
      );
    }
    for (const [key, choices] of Object.entries({
      assignedState: request.connection?.states,
      priority: request.connection?.priorities,
      complexity:
        request.connection?.complexity &&
        jsonObject(request.connection.complexity).options,
      type: request.connection?.types,
    })) {
      const wanted = patch[key];
      if (wanted === undefined || wanted === null || !Array.isArray(choices))
        continue;
      if (typeof wanted !== "string") {
        blockers.push("Invalid destination value for " + key);
        continue;
      }
      const native = key === "assignedState" ? youTrackState(wanted) : wanted;
      if (!choices.includes(native))
        blockers.push(
          "Destination " + key + " value is unavailable: " + wanted,
        );
    }
  }
  const content = jsonObject(parsed.document.content);
  for (const value of content.tasks as JsonObject[]) {
    for (const field of value.fields as JsonObject[])
      if (!field.readOnly && !request.options)
        blockers.push(
          "Native field publication needs a supported web field adapter: " +
            (typeof field.key === "string" ? field.key : "unknown"),
        );
  }
  for (const value of content.tasks as JsonObject[]) {
    if (
      typeof value.taskId === "string" &&
      request.matches?.[value.taskId] &&
      ((value.comments as JsonObject[]).length ||
        (value.attachments as JsonObject[]).length)
    )
      blockers.push(
        "Matching comments or attachments needs fresh native evidence before publication.",
      );
  }
  for (const upload of result.batch.uploads as JsonObject[]) {
    const file = jsonObject(upload.file);
    if (typeof file.size !== "number" || file.size > CLOUD_UPLOAD_LIMIT)
      blockers.push(
        "YouTrack accepts files up to 10 MiB. Keep the original attachment.",
      );
  }
  if (
    Object.values(cloudData(request.state).records).some((record) => {
      return record.status !== "confirmed";
    })
  )
    blockers.push(
      "Resolve the current delivery review before queuing a task plan.",
    );
  result.preview.blockers = [...new Set(blockers)];
  result.preview.ready = result.preview.ready === true && blockers.length === 0;
  return { ...result, blobs: parsed.blobs };
};
