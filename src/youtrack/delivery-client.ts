import { authRequestGuard } from "@/auth/session";
import type { DeliveryPort } from "@/cloud/types";
import { nativeEditKey } from "@/domain/native-edit-fields";
import type { TaskItem, TaskPatch } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { AttachmentClient } from "./attachment-client";
import { postComment, verifyComment } from "./comments";
import { readDeliveryTasks } from "./delivery-read";
import { changeParent, childrenOf } from "./hierarchy";
import { incomingMarks } from "./incoming-revision";
import type { Field } from "./issue-body";
import { creationBody, issueBody } from "./issue-body";
import { NativeEditAdapter } from "./native-edit-adapter";
import { readDeletionState } from "./read-deletion-state";
import { readDeliveryIssue } from "./read-delivery-issue";
import type { YouTrackRequest } from "./request";
import { issueId, sessionRequest } from "./request";
import { SharedStatusClient } from "./shared-status-client";
import { TagClient } from "./tags";
export class DeliveryClient implements DeliveryPort {
  accountId = "";
  readonly assertCurrent: () => void;
  files: AttachmentClient;
  tags: TagClient;
  metadata?: SharedStatusClient;
  private request: YouTrackRequest;
  private fields = new Map<string, Field[]>();
  private native: NativeEditAdapter;
  private creations = new Map<string, unknown>();
  constructor(token: string, shared = false) {
    this.assertCurrent = authRequestGuard(token);
    this.request = sessionRequest(token);
    this.native = new NativeEditAdapter(this.request, this.get, (id) => {
      return this.fields.get(id) ?? [];
    });
    this.tags = new TagClient(this.request);
    this.files = new AttachmentClient(this.request, token.trim());
    if (shared) this.metadata = new SharedStatusClient(this.request);
  }
  connect = async () => {
    const user = (await this.request("users/me?fields=id")) as {
      id?: unknown;
    } | null;
    if (!user || typeof user.id !== "string")
      throw Error("Could not verify the YouTrack account.");
    this.accountId = user.id;
    await this.metadata?.probe();
  };
  marks = () => {
    return incomingMarks(this.request);
  };
  all = async () => {
    const items = await readDeliveryTasks(this.request);
    return this.metadata ? this.metadata.annotateAll(items) : items;
  };
  get = async (id: string) => {
    const result = await readDeliveryIssue(this.request, id);
    if (!result) return null;
    const { item, fields } = result;
    this.fields.set(id, fields);
    return this.metadata ? this.metadata.annotate(item) : item;
  };
  deletionState = (id: string) => {
    return readDeletionState(this.request, this.get, id, this.accountId);
  };
  prepareUpdate = (id: string, patch: TaskPatch, expected: TaskItem) => {
    return this.native.prepare(id, patch, expected);
  };
  update = async (id: string, patch: TaskPatch, expected?: TaskItem) => {
    issueId(id);
    if (
      this.metadata &&
      (patch.state !== undefined || patch.assignedState !== undefined)
    )
      throw Error(
        "Shared status must use the revision-checked status endpoint.",
      );
    if (
      (patch.state !== undefined || patch.assignedState !== undefined) &&
      typeof this.fields.get(id)?.find((field) => {
        return field.name === "State";
      })?.value?.name !== "string"
    )
      throw Error("The current native State value cannot be verified.");
    const extra = await this.native.fieldsFor(id, patch, expected);
    const basic = Object.fromEntries(
      Object.entries(patch).filter(([key]) => {
        return !nativeEditKey(key);
      }),
    ) as TaskPatch;
    const body = issueBody(basic, this.fields.get(id) ?? []);
    if (extra.length)
      body.customFields = [
        ...((body.customFields ?? []) as unknown[]),
        ...extra,
      ];
    if (Object.keys(body).length)
      await this.request("issues/" + id, "POST", body);
    if (patch.parentId !== undefined)
      await changeParent(
        this.request,
        this.get,
        id,
        patch.parentId,
        expected?.parentId,
      );
  };
  prepareCreate = async (item: TaskItem) => {
    validateTask(item);
    if (item.parentId && !(await this.get(item.parentId)))
      throw Error("The creation parent is not readable.");
    this.creations.set(
      item.id,
      await this.native.creation(item, await creationBody(this.request, item)),
    );
  };
  create = async (item: TaskItem) => {
    const body = this.creations.get(item.id);
    if (!body) throw Error("Creation was not prepared.");
    const receipt = (await this.request(
      "issues?fields=idReadable",
      "POST",
      body,
    )) as { idReadable?: string } | null;
    if (!receipt?.idReadable) throw Error("Missing creation receipt.");
    return { id: issueId(receipt.idReadable) };
  };
  children = (id: string) => {
    return childrenOf(this.request, id);
  };
  remove = async (id: string) => {
    await this.request("issues/" + issueId(id), "DELETE");
  };
  verifyComment = (id: string, commentId: string, text: string) => {
    return verifyComment(this.request, id, commentId, text);
  };
  comment = (id: string, text: string) => {
    return postComment(this.request, id, text);
  };
  readShared = async () => {
    const metadata = new SharedStatusClient(this.request);
    await metadata.probe();
    return metadata.annotateAll(await readDeliveryTasks(this.request));
  };
  enableShared = () => {
    this.metadata = new SharedStatusClient(this.request);
  };
}
