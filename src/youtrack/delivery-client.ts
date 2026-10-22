import type { DeliveryPort } from "@/cloud/types";
import type { TaskPatch } from "@/domain/types";
import { validateTask } from "@/domain/validate-task";
import type { RawIssue } from "./read-tasks";
import { normalize, YOUTRACK_ORIGIN } from "./read-tasks";
const fields =
  "id,idReadable,summary,description,updated,project(shortName),parent(issues(idReadable)),customFields(id,name,$type,value(name)),commentsCount,comments(id,text,created,author(login,fullName))";
type Field = Record<"name" | "$type" | "id", string>;
export class DeliveryClient implements DeliveryPort {
  accountId = "";
  private token: string;
  private fields = new Map<string, Field[]>();
  constructor(token: string) {
    this.token = token.trim();
    if (!this.token) throw Error("Enter a YouTrack token.");
  }
  private request = async (
    route: string,
    method = "GET",
    body?: unknown,
  ): Promise<unknown> => {
    const response = await fetch(YOUTRACK_ORIGIN + "/api/" + route, {
      method,
      headers: {
        Authorization: "Bearer " + this.token,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok)
      throw Error("YouTrack request failed (HTTP " + response.status + ").");
    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : null;
  };
  connect = async () => {
    const user = (await this.request("users/me?fields=id")) as {
      id?: unknown;
    } | null;
    if (!user || typeof user.id !== "string")
      throw Error("Could not verify the YouTrack account.");
    this.accountId = user.id;
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
  update = async (id: string, patch: TaskPatch) => {
    if (!/^PMON-\d+$/.test(id)) throw Error("Invalid task.");
    const body: Record<string, unknown> = {};
    const customFields: unknown[] = [];
    for (const [key, value] of Object.entries(patch)) {
      if (key === "summary" || key === "description") {
        body[key] = value;
        continue;
      }
      const name =
        key === "priority"
          ? "Priority"
          : key === "complexity"
            ? "Complexity"
            : null;
      const field = this.fields.get(id)?.find((candidate) => {
        return candidate.name === name;
      });
      if (
        !name ||
        field?.$type !== "SingleEnumIssueCustomField" ||
        typeof field.id !== "string" ||
        !field.id
      )
        throw Error(
          "This field cannot be safely delivered with its current configuration.",
        );
      customFields.push({
        id: field.id,
        name,
        $type: field.$type,
        value: value === null ? null : { name: value },
      });
    }
    if (customFields.length) body.customFields = customFields;
    await this.request("issues/" + id, "POST", body);
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
