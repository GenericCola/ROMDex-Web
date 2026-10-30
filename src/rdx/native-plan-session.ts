import { authIdentity, authRequestGuard, authToken } from "@/auth/session";
import { equal } from "@/cloud/delivery-helpers";
import { pullPlan } from "@/domain/accepted/rdx/plan-pull.mjs";
import { jsonObject, type JsonObject } from "@/domain/json";
import { workspaceStore } from "@/domain/workspace-store";
import { AttachmentClient } from "@/youtrack/attachment-client";
import { readComments } from "@/youtrack/read-comments";
import { readDeliveryIssue } from "@/youtrack/read-delivery-issue";
import { sessionRequest } from "@/youtrack/request";
import { readRdx, writeRdx } from "./container";
import { inspectRdx } from "./inspect";
import { fileBytes, rdxFile, retainRdx } from "./library";
import { readNativePlanEvidence } from "./native-plan-evidence";
import { planFile } from "./plan-documents";
import type { PlanReviewSession } from "./plan-review-session";
export class NativePlanSession {
  private generation = 0;
  cancel = () => {
    ++this.generation;
  };
  review = async (
    input: JsonObject,
    fields: PlanReviewSession,
    resolve = false,
  ) => {
    if (typeof input.key !== "string")
      throw Error("Choose a retained task plan.");
    if (resolve && (input.approved !== true || typeof input.token !== "string"))
      throw Error("Explicit native conflict approval is required.");
    const token = authToken(),
      authGuard = authRequestGuard(token),
      { generation } = this;
    const assertCurrent = () => {
      authGuard();
      if (generation !== this.generation)
        throw Error("The native plan review was closed.");
    };
    await fields.refresh();
    assertCurrent();
    const options = fields.fieldOptions();
    if (!options || !authIdentity().projectId)
      throw Error("Refresh native field options first.");
    await workspaceStore.flush();
    const opened = workspaceStore.getSnapshot();
    if (!opened.ready || opened.error || opened.delivering || opened.updating)
      throw Error(
        "Finish the current workspace operation before reviewing a plan.",
      );
    const baseline = structuredClone(opened.data),
      file = planFile(input.key),
      ledger = baseline.rdxImports?.[input.key];
    if (
      !ledger ||
      Object.values(ledger.batches).some((batch) => {
        return batch.status !== "complete";
      })
    )
      throw Error("Finish the plan publication before pulling native edits.");
    const value = await readRdx(fileBytes(file));
    const request = sessionRequest(token);
    const evidence = await readNativePlanEvidence(
      ledger,
      {
        issue: async (id) => {
          return (await readDeliveryIssue(request, id))?.item ?? null;
        },
        comments: (id) => {
          return readComments(request, id);
        },
        files: new AttachmentClient(request, token),
      },
      assertCurrent,
    );
    const state = structuredClone(baseline);
    state.remote = evidence.remote;
    const choices =
      !resolve || input.choices === undefined ? {} : jsonObject(input.choices);
    if (
      Object.values(choices).some((choice) => {
        return choice !== "local" && choice !== "incoming";
      })
    )
      throw Error("Invalid native conflict decision.");
    const next = pullPlan(value, ledger, state, options, {
      ...evidence,
      choices: choices as Record<string, string>,
    });
    if (resolve && input.token !== next.token)
      throw Error(
        "The plan or native evidence changed. Refresh review before accepting it.",
      );
    const unresolved = next.conflicts.some((conflict) => {
      return !conflict.choice;
    });
    const review = { token: next.token, conflicts: next.conflicts };
    const checked = unresolved
      ? null
      : await inspectRdx({
          action: "inspect",
          bytes: await writeRdx(next.document, next.blobs),
          planOnly: true,
        });
    assertCurrent();
    await workspaceStore.change((data) => {
      assertCurrent();
      if (!equal(data, baseline))
        throw Error(
          "The workspace changed during native review. Nothing was replaced.",
        );
      const current = data.rdxImports?.[input.key as string];
      if (!current) throw Error("The plan binding is missing.");
      if (unresolved) current.review = review;
      else {
        if (!checked) throw Error("Missing verified plan container.");
        retainRdx(data, rdxFile(file.name, checked), file.revision);
        current.tasks = next.bindings;
        for (const binding of Object.values(current.tasks)) {
          const item = evidence.remote.find((native) => {
            return native.id === binding.issueId;
          });
          if (item) binding.pulledUpdated = item.updated;
        }
        delete current.review;
      }
    });
    await workspaceStore.flush();
    assertCurrent();
    return unresolved
      ? review
      : {
          resolved: true,
          conflicts: [],
          message:
            "Native plan changes saved locally. No YouTrack changes were sent.",
        };
  };
}
