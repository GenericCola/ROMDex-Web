import type { AttachmentOperation, AttachmentPort } from "@/attachments/types";
import { uploadId } from "@/attachments/validate";
import { sha256 } from "@/domain/json";
export const verifiedAttachment = async (
  operation: Extract<AttachmentOperation, { type: "attachment" }>,
  files: AttachmentPort,
  account: string,
  id: string,
  before: string[],
) => {
  if (!uploadId(id) || before.includes(id))
    throw Error("Choose an exact new attachment receipt.");
  const inventory = await files.list(operation.issueId),
    file = inventory.find((value) => {
      return value.id === id;
    });
  if (
    file?.name !== operation.file.name ||
    file.size !== operation.file.size ||
    file.authorId !== account
  )
    throw Error("The exact attachment does not match this upload or account.");
  if (
    (await sha256(await files.download(operation.issueId, file))) !==
    operation.file.hash
  )
    throw Error("The attachment bytes do not match the queued file.");
  return inventory;
};
