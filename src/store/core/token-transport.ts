import type { StoreTransport } from "./transport.ts";

/*
 * A transport that signs every call with a permanent token. Node scripts use
 * it (the migration and the live test); the browser has its own adapter over
 * the signed-in session.
 */

const readExactly = async (response: Response, size: number) => {
  const reader = response.body?.getReader();
  if (!reader) throw Error("Attachment bytes could not be read.");
  const bytes = new Uint8Array(size);
  let at = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      if (at + part.value.length > size)
        throw Error("Attachment is larger than its listed size.");
      bytes.set(part.value, at);
      at += part.value.length;
    }
  } finally {
    await reader.cancel().catch(() => {
      return undefined;
    });
  }
  if (at !== size) throw Error("Attachment is smaller than its listed size.");
  return bytes;
};

export const tokenTransport = (
  origin: string,
  token: string,
  timeoutMs = 30000,
): StoreTransport => {
  const root = new URL(origin).origin;
  const headers = { Authorization: "Bearer " + token };
  return {
    request: async (route, method = "GET", body, missingIsError = false) => {
      const form = body instanceof FormData;
      const response = await fetch(root + "/api/" + route, {
        method,
        headers: {
          ...headers,
          Accept: "application/json",
          ...(body !== undefined && !form
            ? { "Content-Type": "application/json" }
            : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        ...(body === undefined
          ? {}
          : { body: form ? body : JSON.stringify(body) }),
      });
      if (response.status === 404 && method === "GET" && !missingIsError)
        return null;
      if (!response.ok)
        throw Error(
          `YouTrack answered ${response.status} to ${method} ${route.split("?")[0] ?? ""}.`,
        );
      const text = await response.text();
      return text ? (JSON.parse(text) as unknown) : null;
    },
    download: async (raw, size) => {
      const url = new URL(raw, root);
      if (
        url.origin !== root ||
        url.username ||
        url.password ||
        !/^\/(?:youtrack\/)?api\/files\//.test(url.pathname)
      )
        throw Error("YouTrack returned an unapproved attachment address.");
      const response = await fetch(url, {
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw Error("Attachment bytes could not be read.");
      return readExactly(response, size);
    },
  };
};
