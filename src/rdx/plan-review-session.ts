import { authIdentity, authRequestGuard, authToken } from "@/auth/session";
import type { PublicationRequest } from "@/domain/accepted/rdx/plan-publication.mjs";
import { jsonObject, type JsonObject } from "@/domain/json";
import { workspaceStore } from "@/domain/workspace-store";
import { uploadStorage } from "@/storage/upload-storage";
import { readEditOptions } from "@/youtrack/edit-options";
import { readPlanSchema } from "@/youtrack/plan-schema";
import { sessionRequest } from "@/youtrack/request";
import type { PlanBatchRecord } from "./plan-ledger";
import { previewBrowserPlan } from "./plan-publication";
import { preparePlanStage } from "./stage-plan";
const strings = (value: unknown): Record<string, string> => {
  if (value === undefined) return {};
  const object = jsonObject(value as JsonObject);
  if (
    Object.values(object).some((entry) => {
      return typeof entry !== "string";
    })
  )
    throw Error("Invalid plan review choices.");
  return object as Record<string, string>;
};
export const publicationInput = (input: JsonObject) => {
  const destination = input.destination ?? null;
  if (destination !== null && typeof destination !== "string")
    throw Error("Invalid plan destination.");
  const deletions = input.deletions ?? [];
  if (
    !Array.isArray(deletions) ||
    deletions.some((id) => {
      return typeof id !== "string";
    }) ||
    new Set(deletions).size !== deletions.length
  )
    throw Error("Invalid plan deletion review.");
  return {
    destination,
    choices: strings(input.choices),
    matches: strings(input.matches),
    mappings: input.mappings === undefined ? {} : jsonObject(input.mappings),
    deletions: deletions as string[],
  };
};
export class PlanReviewSession {
  private generation = 0;
  private schema: JsonObject | null = null;
  private options: JsonObject | null = null;
  private assertSession: (() => void) | null = null;
  cancel = () => {
    ++this.generation;
    this.schema = null;
    this.options = null;
    this.assertSession = null;
  };
  fieldOptions = () => {
    if (!this.options) return null;
    this.assertSession?.();
    return structuredClone(this.options);
  };
  refresh = async () => {
    this.schema = null;
    this.options = null;
    this.assertSession = null;
    const token = authToken(),
      identity = authIdentity(),
      checkAuth = authRequestGuard(token),
      { generation } = this;
    const assertCurrent = () => {
      checkAuth();
      if (generation !== this.generation)
        throw Error("The plan review was closed. Reopen it before queuing.");
    };
    const schema = await readPlanSchema(sessionRequest(token));
    assertCurrent();
    if (schema.projectId !== identity.projectId)
      throw Error(
        "Choose PMON in the signed-in account before reviewing this destination.",
      );
    const native = await readEditOptions(
      sessionRequest(token),
      identity.projectId,
    );
    assertCurrent();
    this.schema = schema;
    this.options = native.options;
    this.assertSession = assertCurrent;
  };
  private request = async (input: JsonObject) => {
    if (!this.schema) await this.refresh();
    const assertCurrent = this.assertSession;
    if (!assertCurrent) throw Error("Refresh project fields before reviewing.");
    assertCurrent();
    const opened = workspaceStore.getSnapshot();
    if (!opened.ready || opened.error || opened.delivering || opened.updating)
      throw Error("Wait for the current workspace save or review to finish.");
    const request: PublicationRequest = {
      ...publicationInput(input),
      state: structuredClone(opened.data),
      connection: this.schema,
      ...(this.options ? { options: this.options } : {}),
    };
    return { request, assertCurrent };
  };
  preview = async (
    bytes: Uint8Array,
    input: JsonObject,
  ): Promise<
    Record<string, unknown> & { previous: PlanBatchRecord | undefined }
  > => {
    const { request, assertCurrent } = await this.request(input),
      result = await previewBrowserPlan(bytes, request);
    assertCurrent();
    const { key, batchId } = result.batch;
    if (typeof key !== "string" || typeof batchId !== "string")
      throw Error("Invalid plan publication identity.");
    return {
      ...result.preview,
      previous: request.state.rdxImports?.[key]?.batches[batchId],
    };
  };
  queue = async (bytes: Uint8Array, input: JsonObject) => {
    if (input.approved !== true || typeof input.token !== "string")
      throw Error("Explicit reviewed plan approval is required.");
    const { request, assertCurrent } = await this.request(input),
      prepared = await preparePlanStage(
        bytes,
        request,
        input.token,
        uploadStorage,
      );
    assertCurrent();
    await workspaceStore.change((data) => {
      assertCurrent();
      prepared.stage(data);
    });
    await workspaceStore.flush();
    assertCurrent();
    return { queued: true, published: false };
  };
}
