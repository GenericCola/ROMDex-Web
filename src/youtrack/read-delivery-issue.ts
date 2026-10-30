import { validateTask } from "@/domain/validate-task";
import type { Field } from "./issue-body";
import { nativeIssueFields } from "./native-task-fields";
import { normalize, type RawIssue } from "./read-tasks";
import type { YouTrackRequest } from "./request";
const fields =
  nativeIssueFields + ",comments(id,text,created,author(login,fullName))";
export const readDeliveryIssue = async (
  request: YouTrackRequest,
  id: string,
) => {
  if (!/^PMON-\d+$/.test(id)) throw Error("Only PMON tasks can be delivered.");
  const raw = (await request(
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

  item.comments = (raw.comments ?? []).map((comment) => {
    return {
      id: comment.id,
      text: comment.text,
      created: comment.created,
      author: comment.author?.fullName ?? comment.author?.login ?? "Unknown",
    };
  });
  validateTask(item);
  return { item, fields: raw.customFields ?? [] };
};
