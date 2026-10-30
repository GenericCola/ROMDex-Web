import { authToken, hasAuthSession } from "@/auth/session";
import { deliveryConnected, requireDelivery } from "@/cloud/session";
import { AttachmentClient } from "./attachment-client";
import { sessionRequest } from "./request";
export const attachmentsReadable = () => {
  return hasAuthSession() || deliveryConnected();
};
export const attachmentReader = () => {
  if (hasAuthSession()) {
    const token = authToken();
    return new AttachmentClient(sessionRequest(token), token);
  }
  const { files } = requireDelivery();
  if (!files) throw Error("Attachment reading is unavailable.");
  return files;
};
