import { equal } from "@/cloud/delivery-helpers";
import type { TagPort } from "@/cloud/tag-types";
import { tagIds, validateTagSelection } from "@/cloud/tag-types";
import { issueId, list, type YouTrackRequest } from "./request";
export const readTagChoices = async (request: YouTrackRequest) => {
  const values = await list<{ id: string; name: string }>(
    request,
    "tags",
    "id,name",
  );
  tagIds(
    values.map((tag) => {
      return tag.id;
    }),
  );
  if (
    values.some((tag) => {
      return typeof tag.name !== "string" || !tag.name;
    })
  )
    throw Error("Tag choices are unavailable.");
  return values;
};
export class TagClient implements TagPort {
  constructor(private request: YouTrackRequest) {}
  prepare = async (id: string, desired: string[], before: string[]) => {
    const options = await readTagChoices(this.request);
    validateTagSelection(desired, before, { ready: true, options });
    if (!equal(await this.list(id), tagIds(before)))
      throw Error("Tags changed during review. Nothing was sent.");
  };
  list = async (id: string) => {
    const values = await list<{ id: string }>(
      this.request,
      `issues/${issueId(id)}/tags`,
      "id",
    );
    return tagIds(
      values.map((tag) => {
        return tag.id;
      }),
    );
  };
  add = async (id: string, tag: string) => {
    tagIds([tag]);
    const response = await this.request(
      `issues/${issueId(id)}/tags?fields=id`,
      "POST",
      { id: tag },
    );
    if (
      !response ||
      typeof response !== "object" ||
      !("id" in response) ||
      response.id !== tag
    )
      throw Error(
        "The tag addition has no exact receipt. Review before retrying.",
      );
  };
  remove = async (id: string, tag: string) => {
    tagIds([tag]);
    await this.request(
      `issues/${issueId(id)}/tags/${encodeURIComponent(tag)}`,
      "DELETE",
    );
  };
}
