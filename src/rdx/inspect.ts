import { projectNPCDex } from "@/domain/accepted/content/projection.mjs";
import {
  mapDomain,
  previewMapImport,
} from "@/domain/accepted/rdx/map-import.mjs";
import { previewPlanImport } from "@/domain/accepted/rdx/plan-merge.mjs";
import type { JsonObject } from "@/domain/json";
import { validateNpcdex } from "@/npcdex/validate";
import { errorText } from "@utils/error-text";
import { readRdx, writeRdx } from "./container";
import type { RdxInspection, RdxRequest } from "./types";
export const inspectRdx = async (
  request: RdxRequest,
): Promise<RdxInspection> => {
  let { bytes } = request,
    parsed = await readRdx(bytes),
    preview = null;
  if (request.planOnly) {
    // Plan imports always pass the same origin/kind gate, including first import.
    const reviewed = previewPlanImport(parsed);
    ({ preview } = reviewed);
  }
  if (request.action === "merge") {
    const local = await readRdx(request.local);
    if (local.document.kind !== parsed.document.kind)
      throw Error("Map and task plan documents cannot be merged.");
    const result =
      parsed.document.kind === "map"
        ? previewMapImport(parsed, local, { choices: request.choices })
        : previewPlanImport(parsed, local, request.choices);
    ({ preview } = result);
    const conflicts = Array.isArray(preview.conflicts) ? preview.conflicts : [];
    if (
      conflicts.some((value) => {
        return (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          !value.choice
        );
      })
    )
      return {
        document: result.document,
        projection: null,
        projectionError: "Choose every conflict before saving.",
        sha256: parsed.containerSha256,
        preview,
        bytes,
      };
    bytes = await writeRdx(result.document, result.blobs);
    parsed = await readRdx(bytes);
  }
  let projection: RdxInspection["projection"] = null,
    projectionError = "";
  if (parsed.document.kind === "map") {
    try {
      if (
        (parsed.document.origin as JsonObject | undefined)?.role ===
        "agent-result"
      )
        throw Error(
          "Agent results require task reconciliation and human testing before current content can change.",
        );
      const domain = mapDomain(parsed);
      projection = structuredClone(
        projectNPCDex(domain, {
          assetBytes: (hash) => {
            return parsed.blobs.get(hash);
          },
        }),
      );
      projection.contentRevision = parsed.document.revision ?? "";
      const { annotations } = projection;
      if (
        annotations &&
        typeof annotations === "object" &&
        !Array.isArray(annotations)
      )
        for (const note of Object.values(annotations))
          if (
            note &&
            typeof note === "object" &&
            !Array.isArray(note) &&
            typeof note.testStatus === "string"
          ) {
            note.importedTestClaim = note.testStatus;
            note.testStatus = "unreviewed";
          }
      const preview = projection.contentPreview;
      if (preview && typeof preview === "object" && !Array.isArray(preview))
        for (const field of ["reviews", "reviewStates"])
          if (Array.isArray(preview[field]))
            for (const review of preview[field])
              if (
                review &&
                typeof review === "object" &&
                !Array.isArray(review)
              ) {
                if (field === "reviews") review.testStatus = "unreviewed";
                else review.status = "unreviewed";
              }
      validateNpcdex(projection);
    } catch (error) {
      projection = null;
      projectionError = errorText(error, "Map projection needs review.");
    }
  }
  return {
    document: parsed.document,
    projection,
    projectionError,
    sha256: parsed.containerSha256,
    preview,
    bytes,
  };
};
