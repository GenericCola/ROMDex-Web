import type { Attachment } from "@/attachments/types";
import type { WorkspaceData } from "@/domain/types";
/** True while the first read of a ticket's attachments is in flight. */
export const attachmentsReading = (
  data: WorkspaceData,
  id: string,
  model: { busy: boolean; readOnlyFiles?: Attachment[] | undefined },
): boolean => {
  return (
    model.busy &&
    !model.readOnlyFiles &&
    !data.attachmentLists?.[id] &&
    !id.startsWith("local-")
  );
};
