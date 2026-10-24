import type { Attachment, AttachmentOperation } from "@/attachments/types";
import { requireDelivery } from "@/cloud/session";
import { useState } from "react";
const AttachmentReview = ({
  operation,
  busy,
}: {
  operation: AttachmentOperation;
  busy: boolean;
}) => {
  const [files, setFiles] = useState<Attachment[]>([]),
    [message, setMessage] = useState(""),
    [reading, setReading] = useState(false);
  const read = async () => {
    setReading(true);
    try {
      const port = requireDelivery();
      if (!port.files) throw Error("Reconnect attachment delivery.");
      setFiles(await port.files.list(operation.issueId));
      setMessage(
        "Current attachment IDs read. No upload or deletion was resent.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Attachment inventory could not be read.",
      );
    } finally {
      setReading(false);
    }
  };
  return (
    <section>
      <p>
        {operation.type === "attachment"
          ? "Confirm an exact new attachment ID. Readback checks filename, size, author and byte hash; it never uploads again."
          : "Confirm only after checking this exact file and your access. A missing attachment may reflect changed permissions."}
      </p>
      <button
        disabled={busy || reading}
        onClick={() => {
          void read();
        }}
      >
        Read Current Attachment IDs
      </button>
      <p role="status">{message}</p>
      <ul>
        {files.map((file) => {
          return (
            <li key={file.id}>
              {file.id} · {file.name} · {file.size} bytes · author{" "}
              {file.authorId}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
export default AttachmentReview;
