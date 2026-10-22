import type { DeliveryPort } from "@/cloud/types";
import type { TaskItem, TaskPatch } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import { readDeliveryTasks } from "./delivery-read";
import { changeParent, childrenOf } from "./hierarchy";
import type { Field } from "./issue-body";
import { creationBody, issueBody } from "./issue-body";
import type { RawIssue } from "./read-tasks";
import { normalize } from "./read-tasks";
import type { YouTrackRequest } from "./request";
import { issueId, sessionRequest } from "./request";
const fields =
  "id,idReadable,summary,description,updated,project(shortName),parent(issues(idReadable)),customFields(id,name,$type,value(name)),commentsCount,comments(id,text,created,author(login,fullName))";
export class DeliveryClient implements DeliveryPort {
  accountId = "";
  private request: YouTrackRequest;
  private fields = new Map<string, Field[]>();
  private creations = new Map<string, unknown>();
  constructor(token: string) {
    this.request = sessionRequest(token);
  }
  connect = async () => {
    const user = (await this.request("users/me?fields=id")) as {
      id?: unknown;
    } | null;
    if (!user || typeof user.id !== "string")
      throw Error("Could not verify the YouTrack account.");
    this.accountId = user.id;
  };
  all = () => {
    return readDeliveryTasks(this.request);
  };
  get = async (id: string) => {
    if (!/^PMON-\d+$/.test(id))
      throw Error("Only PMON tasks can be delivered.");
    const raw = (await this.request(
      "issues/" + id + "?fields=" + encodeURIComponent(fields),
    )) as
      | (RawIssue & {
          customFields: Field[];
          comments?: {
            id: string;
            text: string;
            created: number;
            author?: { fullName?: string; login?: string };
          }[];
        })
      | null;
    if (!raw) return null;
    const item = normalize(raw);
    if (item.id !== id)
      throw Error("YouTrack returned a different task. Nothing was sent.");
    this.fields.set(id, raw.customFields ?? []);
    item.comments = (raw.comments ?? []).map((comment) => {
      return {
        id: comment.id,
        text: comment.text,
        created: comment.created,
        author: comment.author?.fullName ?? comment.author?.login ?? "Unknown",
      };
    });
    validateTask(item);
    return item;
  };
  update = async (id: string, patch: TaskPatch, expected?: TaskItem) => {
    issueId(id);
    if (
      (patch.state !== undefined || patch.assignedState !== undefined) &&
      typeof this.fields.get(id)?.find((field) => {
        return field.name === "State";
      })?.value?.name !== "string"
    )
      throw Error("The current native State value cannot be verified.");
    const body = issueBody(patch, this.fields.get(id) ?? []);
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
    this.creations.set(item.id, await creationBody(this.request, item));
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
  verifyComment = async (id: string, commentId: string, text: string) => {
    if (!/^PMON-\d+$/.test(id) || !/^\d+-\d+$/.test(commentId))
      throw Error("Enter the exact YouTrack comment ID.");
    const comment = (await this.request(
      "issues/" +
        id +
        "/comments/" +
        encodeURIComponent(commentId) +
        "?fields=id,text,deleted",
    )) as { id?: unknown; text?: unknown; deleted?: boolean } | null;
    if (
      comment?.id !== commentId ||
      comment.deleted !== false ||
      comment.text !== text
    )
      throw Error(
        "That comment does not match the queued text. Nothing was sent.",
      );
  };
  comment = async (id: string, text: string) => {
    if (!/^PMON-\d+$/.test(id)) throw Error("Invalid task.");
    const receipt = (await this.request(
      "issues/" + id + "/comments?fields=id",
      "POST",
      { text },
    )) as { id?: unknown } | null;
    if (!receipt || typeof receipt.id !== "string")
      throw Error("Missing comment receipt.");
    return { id: receipt.id };
  };
}
