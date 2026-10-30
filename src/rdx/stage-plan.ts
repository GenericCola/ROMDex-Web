import type { UploadStore } from "@/attachments/types";
import { validateUploadFile } from "@/attachments/validate";
import { validateQueue } from "@/cloud/validation";
import { stageReviewedPlan } from "@/domain/accepted/plan-queue.mjs";
import type { PublicationRequest } from "@/domain/accepted/rdx/plan-publication.mjs";
import { jsonObject, sha256, type JsonObject } from "@/domain/json";
import type { TaskOperation, WorkspaceData } from "@/domain/types";
import { validateWorkspace } from "@/domain/workspace-data";
import { previewBrowserPlan } from "./plan-publication";
type PlanPreview = Awaited<ReturnType<typeof previewBrowserPlan>>;
const text = (value: unknown) => {
  if (typeof value !== "string" || !value)
    throw Error("Invalid plan publication identity.");
  return value;
};
export const storePlanUploads = async (
  preview: PlanPreview,
  storage: UploadStore,
) => {
  if (preview.preview.ready !== true)
    throw Error("Review all plan blockers first.");
  for (const value of preview.batch.uploads as JsonObject[]) {
    const id = text(value.uploadId),
      file = jsonObject(value.file);
    const candidate = {
      name: text(file.name),
      size: Number(file.size),
      mimeType: text(file.mimeType),
      hash: text(file.hash),
    };
    validateUploadFile(candidate);
    const bytes = preview.blobs.get(candidate.hash);
    if (
      bytes?.length !== candidate.size ||
      (await sha256(bytes)) !== candidate.hash
    )
      throw Error("Plan attachment bytes differ from their reviewed checksum.");
    const prior = await storage.get(id);
    if (
      prior &&
      (JSON.stringify(prior.file) !== JSON.stringify(candidate) ||
        (await sha256(new Uint8Array(await prior.blob.arrayBuffer()))) !==
          candidate.hash)
    )
      throw Error(
        "A staged file with this identity differs. Keep both source files.",
      );
    if (!prior)
      await storage.put({
        id,
        file: candidate,
        blob: new Blob([new Uint8Array(bytes)], { type: candidate.mimeType }),
      });
  }
};
export const preparePlanStage = async (
  bytes: Uint8Array,
  request: PublicationRequest,
  reviewedToken: string,
  storage?: UploadStore,
) => {
  const preview = await previewBrowserPlan(bytes, request);
  if (preview.preview.token !== reviewedToken || preview.preview.ready !== true)
    throw Error("The plan or workspace changed. Review the publication again.");
  if ((preview.batch.uploads as JsonObject[]).length) {
    if (!storage)
      throw Error("Persist the reviewed plan attachments before queuing.");
    await storePlanUploads(preview, storage);
  }
  const baseline = JSON.stringify(request.state);
  const stage = (data: WorkspaceData) => {
    if (JSON.stringify(data) !== baseline)
      throw Error("The workspace changed after plan review.");
    const next = structuredClone(data),
      { batch } = preview;
    const key = text(batch.key),
      batchId = text(batch.batchId);
    const existing = next.rdxImports?.[key];
    if (existing?.batches[batchId]) return;
    const operations = structuredClone(
      batch.operations,
    ) as unknown as TaskOperation[];
    for (const operation of operations) {
      if (operation.type === "create") operation.item.complexity ??= null;
      if (operation.type === "comment") operation.created = Date.now();
      if (operation.type === "delete")
        operation.issueId = text(operation.ids[0]);
    }
    validateQueue({ ...next, operations: [...next.operations, ...operations] });
    stageReviewedPlan(next, {
      ...batch,
      operations: operations as unknown as JsonObject[],
    });
    validateWorkspace(next);
    Object.assign(data, next);
  };
  return { preview, stage };
};
