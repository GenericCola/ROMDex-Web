import type { YouTrackRequest } from "./request";
export const verifyComment = async (
  request: YouTrackRequest,
  id: string,
  commentId: string,
  text: string,
) => {
  if (!/^PMON-\d+$/.test(id) || !/^\d+-\d+$/.test(commentId))
    throw Error("Enter the exact YouTrack comment ID.");
  const comment = (await request(
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
export const postComment = async (
  request: YouTrackRequest,
  id: string,
  text: string,
) => {
  if (!/^PMON-\d+$/.test(id)) throw Error("Invalid task.");
  const receipt = (await request(
    "issues/" + id + "/comments?fields=id",
    "POST",
    { text },
  )) as { id?: unknown } | null;
  if (!receipt || typeof receipt.id !== "string")
    throw Error("Missing comment receipt.");
  return { id: receipt.id };
};
