import { MAX_UPLOAD } from "@/attachments/validate";
import { YOUTRACK_ORIGIN } from "./read-tasks";
export const attachmentBytes = (value: string) => {
  const token = value.trim();
  return async (raw: string, expected: number) => {
    if (expected > MAX_UPLOAD)
      throw Error("Download is limited to 50 MiB per file.");
    const url = new URL(raw, YOUTRACK_ORIGIN);
    if (
      url.origin !== YOUTRACK_ORIGIN ||
      url.username ||
      url.password ||
      !/^\/(?:youtrack\/)?api\/files\//.test(url.pathname)
    )
      throw Error("YouTrack returned an unapproved attachment address.");
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok || !response.body)
      throw Error("Attachment bytes could not be read.");
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > expected || size > MAX_UPLOAD)
          throw Error("Attachment bytes exceed their verified size.");
        chunks.push(part.value);
      }
    } finally {
      await reader.cancel().catch(() => {
        return undefined;
      });
    }
    if (size !== expected) throw Error("Attachment byte count differs.");
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.length;
    }
    return bytes;
  };
};
