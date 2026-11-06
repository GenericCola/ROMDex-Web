import type { WorkspaceData } from "@/domain/types";
import { attachmentsReading } from "./attachments-reading";
import Pending from "./pending";
import type { useAttachments } from "./use-attachments";
const AttachmentStatus = ({
  data,
  id,
  model,
  className,
}: {
  data: WorkspaceData;
  id: string;
  model: ReturnType<typeof useAttachments>;
  className: string;
}) => {
  return (
    <Pending
      className={className}
      active={model.busy}
      label={
        attachmentsReading(data, id, model)
          ? "Reading attachments…"
          : "Working on attachments…"
      }
      message={model.message}
    />
  );
};
export default AttachmentStatus;
