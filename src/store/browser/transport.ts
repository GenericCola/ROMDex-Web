import { attachmentBytes } from "@/youtrack/attachment-bytes";
import { sessionRequest } from "@/youtrack/request";
import type { StoreTransport } from "../core/transport.ts";

/** The store's transport over the signed-in session (token or cookie). */
export const sessionTransport = (token: string): StoreTransport => {
  const download = attachmentBytes(token);
  return {
    request: sessionRequest(token),
    download: (url, size, target) => {
      return download(url, size, target);
    },
  };
};
