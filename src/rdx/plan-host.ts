import { encodeBytes } from "@/domain/bytes";
import { jsonObject, type JsonObject } from "@/domain/json";
import { readRdx, writeRdx } from "./container";
import { fileBytes } from "./library";
import { NativePlanSession } from "./native-plan-session";
import { planContext } from "./plan-context";
import {
  editPlanDocument,
  planFile,
  reviewPlanImport,
  storePlan,
} from "./plan-documents";
import { PlanReviewSession } from "./plan-review-session";
import { PlanTransfer } from "./plan-transfer";
const text = (value: unknown) => {
  if (typeof value !== "string") throw Error("Invalid plan request.");
  return value;
};
const choices = (value: unknown): Record<string, string> => {
  if (value === undefined) return {};
  const object = jsonObject(value as JsonObject);
  for (const entry of Object.values(object)) text(entry);
  return object as Record<string, string>;
};
export class BrowserPlanHost {
  private transfer = new PlanTransfer();
  private publication = new PlanReviewSession();
  private native = new NativePlanSession();
  private exporting: { id: string; bytes: Uint8Array } | null = null;
  cancel = () => {
    this.transfer.cancel();
    this.publication.cancel();
    this.native.cancel();
    this.exporting = null;
  };

  api = async (route: string, input: JsonObject = {}): Promise<unknown> => {
    if (route === "sync-review" || route === "resolve-native")
      return this.native.review(
        input,
        this.publication,
        route === "resolve-native",
      );
    if (route === "context")
      return planContext(this.publication.fieldOptions());
    if (route === "refresh-fields") {
      await this.publication.refresh();
      return planContext(this.publication.fieldOptions());
    }
    if (route === "begin") return this.transfer.begin(input.bytes);
    if (route === "chunk")
      return this.transfer.chunk(input.id, input.offset, input.base64);
    if (route === "cancel") {
      this.cancel();
      return true;
    }
    if (route === "preview" || route === "import") {
      const bytes = this.transfer.read(input.id),
        result = await reviewPlanImport(bytes, choices(input.choices));
      if (route === "preview") return { ...result.preview, key: result.key };
      if (
        input.approved !== true ||
        input.token !== result.preview.token ||
        (result.preview.conflicts as JsonObject[]).some((conflict) => {
          return !conflict.choice;
        })
      )
        throw Error("The plan review changed. Review every conflict first.");
      const merged = await writeRdx(result.document, result.blobs);
      await storePlan(bytes, result.baseline);
      await storePlan(merged, planFile(result.key).revision);
      this.transfer.cancel();
      return { saved: true, key: result.key, published: false };
    }
    if (route === "edit" || route === "cancel-deletion")
      return editPlanDocument(input, route === "cancel-deletion");
    const file = planFile(input.key),
      bytes = fileBytes(file);
    if (route === "view")
      return {
        document: (await readRdx(bytes)).document,
        status: { saved: true },
      };
    if (route === "publication-preview")
      return this.publication.preview(bytes, input);
    if (route === "queue") return this.publication.queue(bytes, input);
    if (route === "export") {
      this.exporting = { id: crypto.randomUUID(), bytes };
      return {
        id: this.exporting.id,
        bytes: bytes.length,
        sha256: file.sha256,
        chunkBytes: 512 * 1024,
      };
    }
    if (route === "export-chunk") {
      if (
        !this.exporting ||
        input.id !== this.exporting.id ||
        typeof input.offset !== "number" ||
        !Number.isSafeInteger(input.offset) ||
        input.offset < 0
      )
        throw Error("Invalid export request.");
      return {
        base64: encodeBytes(
          this.exporting.bytes.slice(input.offset, input.offset + 512 * 1024),
        ),
      };
    }
    if (route === "export-end") {
      this.exporting = null;
      return true;
    }
    throw Error(
      "This native plan action is not yet supported in the web adapter.",
    );
  };
}
