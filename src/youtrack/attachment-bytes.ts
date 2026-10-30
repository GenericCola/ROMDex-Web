import { MAX_UPLOAD } from "@/attachments/validate";
import { cookieFetch, isCookieHandle } from "@/auth/cookie-client";
import { authRequestGuard } from "@/auth/session";
import { YOUTRACK_ORIGIN } from "./read-tasks";
export const attachmentBytes = (value: string) => {
  const token = value.trim();
  const assertSession = authRequestGuard(token);
  return async (
    raw: string,
    expected: number,
    attachment?: { issue: string; id: string },
  ) => {
    assertSession();
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
    if (isCookieHandle(token) && !attachment)
      throw Error("Verified attachment identity required.");
    const response = isCookieHandle(token)
      ? await cookieFetch(
          token,
          "/api/attachment?issue=" +
            encodeURIComponent(attachment?.issue ?? "") +
            "&id=" +
            encodeURIComponent(attachment?.id ?? "") +
            "&size=" +
            expected,
        )
      : await fetch(url, {
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
        assertSession();
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
    assertSession();
    return bytes;
  };
};
