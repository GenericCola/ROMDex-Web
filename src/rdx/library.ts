import { base64Bytes, jsonObject, parseJson } from "@/domain/json";
import type { WorkspaceData } from "@/domain/types";
import { validateNpcdex } from "@/npcdex/validate";
import type { RdxFile, RdxInspection } from "./types";
export const rdxKey = (document: {
  datasetId: unknown;
  documentId: unknown;
}) => {
  return JSON.stringify([document.datasetId, document.documentId]);
};
export const fileBytes = (file: RdxFile) => {
  return base64Bytes(file.data);
};
export const encodeBytes = (bytes: Uint8Array) => {
  let text = "";
  for (let index = 0; index < bytes.length; index += 8192)
    text += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(text);
};
export const rdxFile = (name: string, value: RdxInspection): RdxFile => {
  const { document } = value;
  if (
    typeof document.documentId !== "string" ||
    typeof document.datasetId !== "string" ||
    typeof document.revision !== "string" ||
    (document.kind !== "map" && document.kind !== "plan")
  )
    throw Error("Invalid RDX identity.");
  return {
    name: name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "document.rdx",
    sha256: value.sha256,
    bytes: value.bytes.length,
    data: encodeBytes(value.bytes),
    documentId: document.documentId,
    datasetId: document.datasetId,
    revision: document.revision,
    kind: document.kind,
  };
};
export const retainRdx = (
  data: WorkspaceData,
  file: RdxFile,
  expected: string | null,
) => {
  const files = (data.rdxFiles ??= []),
    head = files.findLast((value) => {
      return rdxKey(value) === rdxKey(file);
    });
  if ((head?.revision ?? null) !== expected)
    throw Error(
      "The managed document changed after preview. Select the file again.",
    );
  if (
    files.some((value) => {
      return value.sha256 === file.sha256;
    })
  )
    return;
  if (
    files.reduce((total, value) => {
      return total + value.bytes;
    }, file.bytes) >
    64 * 1024 * 1024
  )
    throw Error(
      "The browser RDX library exceeds 64 MiB. Export recovery before making room.",
    );
  data.rdxFiles = [...files, file];
};
export const openRdxMap = (data: WorkspaceData, value: RdxInspection) => {
  if (!value.projection)
    throw Error(
      value.projectionError || "This file cannot be opened as an NPCDex map.",
    );
  validateNpcdex(value.projection);
  if (data.npcdex) {
    data.npcdexHistory ??= [];
    data.npcdexHistory.push({
      kind: "retained-workspace",
      at: new Date().toISOString(),
      document: structuredClone(data.npcdex),
      drafts: jsonObject(parseJson(JSON.stringify(data.npcdexDrafts ?? {}))),
    });
  }
  data.npcdex = structuredClone(value.projection);
  data.npcdexDrafts = {};
  delete data.view.npcdex;
  data.view.workspace = "npcdex";
};
export const validateRdxFiles = (data: WorkspaceData) => {
  if (data.rdxFiles === undefined) return;
  if (!Array.isArray(data.rdxFiles) || data.rdxFiles.length > 1000)
    throw Error("Invalid RDX library.");
  const seen = new Set<string>();
  let total = 0;
  for (const file of data.rdxFiles) {
    if (
      !file ||
      typeof file.name !== "string" ||
      typeof file.documentId !== "string" ||
      typeof file.datasetId !== "string" ||
      !["map", "plan"].includes(file.kind) ||
      typeof file.revision !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.revision) ||
      typeof file.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 12 ||
      typeof file.data !== "string" ||
      file.data.length !== 4 * Math.ceil(file.bytes / 3) ||
      seen.has(file.sha256)
    )
      throw Error("Invalid retained RDX file.");
    seen.add(file.sha256);
    total += file.bytes;
  }
  if (total > 64 * 1024 * 1024)
    throw Error("Retained RDX files exceed 64 MiB.");
};
