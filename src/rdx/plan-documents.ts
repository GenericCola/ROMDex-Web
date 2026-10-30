import {
  previewPlanImport,
  taskRevision,
} from "@/domain/accepted/rdx/plan-merge.mjs";
import { jsonObject, type JsonObject } from "@/domain/json";
import { workspaceStore } from "@/domain/workspace-store";
import { documentRevision, readRdx, writeRdx } from "./container";
import { inspectRdx } from "./inspect";
import { fileBytes, rdxFile, retainRdx } from "./library";
export const planKey = (document: {
  datasetId: unknown;
  documentId: unknown;
}) => {
  if (
    typeof document.datasetId !== "string" ||
    typeof document.documentId !== "string"
  )
    throw Error("Invalid plan identity.");
  return document.datasetId + ":" + document.documentId;
};
export const planFile = (key: unknown) => {
  const file = workspaceStore
    .getSnapshot()
    .data.rdxFiles?.findLast((candidate) => {
      return candidate.kind === "plan" && planKey(candidate) === key;
    });
  if (!file) throw Error("Choose a retained local task plan.");
  return file;
};
export const storePlan = async (bytes: Uint8Array, expected: string | null) => {
  const checked = await inspectRdx({
    action: "inspect",
    bytes,
    planOnly: true,
  });
  await workspaceStore.change((data) => {
    retainRdx(data, rdxFile("ROMDex-Plan.rdx", checked), expected);
  });
  await workspaceStore.flush();
  return planKey(
    checked.document as { datasetId: unknown; documentId: unknown },
  );
};
export const reviewPlanImport = async (
  bytes: Uint8Array,
  choices: Record<string, string>,
) => {
  const incoming = await readRdx(bytes),
    key = planKey(
      incoming.document as { datasetId: unknown; documentId: unknown },
    );
  const file = workspaceStore
    .getSnapshot()
    .data.rdxFiles?.findLast((candidate) => {
      return candidate.kind === "plan" && planKey(candidate) === key;
    });
  const local = file ? await readRdx(fileBytes(file)) : null;
  return {
    ...previewPlanImport(incoming, local, choices),
    key,
    baseline: file?.revision ?? null,
  };
};
export const editPlanDocument = async (
  input: JsonObject,
  cancelDeletion = false,
) => {
  if (typeof input.taskId !== "string")
    throw Error("Choose a task in the plan.");
  const file = planFile(input.key),
    value = await readRdx(fileBytes(file));
  if (input.expectedRevision !== value.document.revision)
    throw Error("The plan changed. Reopen it before editing.");
  const document = structuredClone(value.document),
    content = jsonObject(document.content);
  const tasks = content.tasks as JsonObject[],
    requests = content.deletionRequests as JsonObject[];
  if (cancelDeletion) {
    const ledger =
      workspaceStore.getSnapshot().data.rdxImports?.[planKey(file)];
    if (
      ledger?.tasks[input.taskId]?.deleted ||
      Object.values(ledger?.batches ?? {}).some((batch) => {
        return batch.status !== "complete";
      })
    )
      throw Error(
        "Review queued native actions before changing this deletion request.",
      );
    if (
      !requests.some((request) => {
        return request.taskId === input.taskId;
      })
    )
      throw Error("No matching deletion request.");
    content.deletionRequests = requests.filter((request) => {
      return request.taskId !== input.taskId;
    });
  } else {
    const task = tasks.find((task) => {
        return task.taskId === input.taskId;
      }),
      patch = jsonObject(input.patch);
    if (
      !task ||
      requests.some((request) => {
        return request.taskId === input.taskId;
      })
    )
      throw Error("Task missing or has a pinned deletion request.");
    if (
      !Object.keys(patch).every((key) => {
        return [
          "title",
          "description",
          "status",
          "priority",
          "complexity",
        ].includes(key);
      })
    )
      throw Error("Unsupported local plan edit.");
    task.baseRevision = taskRevision(task);
    Object.assign(task, patch);
  }
  document.revision = documentRevision(document);
  await storePlan(await writeRdx(document, value.blobs), file.revision);
  return { document, status: { saved: true } };
};
