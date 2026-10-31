import type { TaskItem } from "@/domain/types";
import { YouTrackHttpError } from "./http-error";
import type { YouTrackRequest } from "./request";
import { issueId } from "./request";
export const readDeletionState = async (
  request: YouTrackRequest,
  get: (id: string) => Promise<TaskItem | null>,
  id: string,
  accountId: string,
) => {
  issueId(id);
  try {
    const probe = (await request(
      "issues/" + id + "?fields=idReadable",
      "GET",
      undefined,
      true,
    )) as { idReadable?: unknown } | null;
    if (probe?.idReadable !== id)
      throw Error("Deletion readback returned an invalid task.");
  } catch (error) {
    if (
      !(error instanceof YouTrackHttpError) ||
      ![404, 410].includes(error.status)
    )
      throw error;
    const user = (await request("users/me?fields=id")) as {
      id?: unknown;
    } | null;
    if (user?.id !== accountId)
      throw Error(
        "The signed-in account changed. Deletion was not confirmed.",
        { cause: error },
      );
    return { item: null, gone: error.status === 410 };
  }
  const item = await get(id);
  if (!item)
    throw Error("The task changed during deletion readback. Read it again.");
  return { item, gone: false };
};
