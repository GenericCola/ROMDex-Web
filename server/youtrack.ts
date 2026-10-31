import type { ApplicationDependencies } from "./application.ts";
import type { authorizeCookie } from "./cookie-authorize.ts";
import { response } from "./runtime-http.ts";
import { HttpFailure } from "./runtime-types.ts";
import { boundedText } from "./transport-bounds.ts";
import { transportRoute } from "./transport-policy.ts";
import { authorizeWrite, requireIssue } from "./write-policy.ts";
type Session = Awaited<ReturnType<typeof authorizeCookie>>;
export const ROOT = "https://thegobindsingh.youtrack.cloud";
export function alive(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
) {
  if (request.signal.aborted || deps.now() >= session.expiresAt)
    throw new HttpFailure(401);
}
export async function upstream(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
  url: URL,
  init: RequestInit = {},
) {
  alive(request, session, deps);
  const result = await deps.fetch(url, {
    ...init,
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    headers: {
      ...init.headers,
      Authorization: "Bearer " + session.accessToken,
      Accept: "application/json",
    },
  });
  alive(request, session, deps);
  if (!result.ok)
    throw new HttpFailure(
      [400, 401, 403, 404, 409, 410, 413, 429].includes(result.status)
        ? result.status
        : 502,
    );
  return result;
}
export async function readJSON(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
  route: string,
): Promise<any> {
  const result = await upstream(
    request,
    session,
    deps,
    transportRoute(route, "GET"),
  );
  const value = JSON.parse(await boundedText(result.body, 4_000_000));
  alive(request, session, deps);
  return value;
}
async function uploadBody(request: Request) {
  if (
    !/^multipart\/form-data;\s*boundary=/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new HttpFailure(415);
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 4_100_000))
    throw new HttpFailure(413);
  // Count actual bytes before parsing or dispatch; no reliance on Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpFailure(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4_100_000) throw new HttpFailure(413);
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = Buffer.concat(chunks);
  const form = await new Response(bytes, {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
  const entries = [...form.entries()];
  const file = entries[0]?.[1];
  if (
    entries.length !== 1 ||
    entries[0]?.[0] !== "upload" ||
    !(file instanceof File) ||
    !file.size ||
    file.size > 4_000_000 ||
    file.name.length > 255
  )
    throw new HttpFailure(413);
  // Re-encode validated single file rather than forwarding untrusted multipart fields.
  const clean = new FormData();
  clean.append("upload", file, file.name);
  return clean;
}
export async function jsonProxy(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
) {
  const query = new URL(request.url).searchParams;
  if (
    query.getAll("route").length !== 1 ||
    [...query.keys()].some((key) => key !== "route")
  )
    throw new HttpFailure(400);
  let url: URL;
  try {
    url = transportRoute(query.get("route")!, request.method);
  } catch {
    throw new HttpFailure(403);
  }
  let body: unknown,
    send: BodyInit | undefined,
    headers: Record<string, string> = {};
  if (request.method !== "GET") {
    if (url.pathname.endsWith("/attachments") && request.method === "POST") {
      await authorizeWrite(request, session, deps, url, undefined);
      send = await uploadBody(request);
    } else {
      const raw = await boundedText(request.body, 1_000_000);
      if (raw) {
        if (
          !/^application\/json(?:;|$)/i.test(
            request.headers.get("content-type") ?? "",
          )
        )
          throw new HttpFailure(415);
        try {
          body = JSON.parse(raw);
        } catch {
          throw new HttpFailure(400);
        }
        send = JSON.stringify(body);
        headers = { "Content-Type": "application/json" };
      }
      await authorizeWrite(request, session, deps, url, body);
    }
  }
  const result = await upstream(request, session, deps, url, {
    method: request.method,
    headers,
    ...(send === undefined ? {} : { body: send }),
  });
  if (result.status === 204) return response(204, null);
  const raw = await boundedText(result.body, 4_000_000);
  alive(request, session, deps);
  return response(200, raw ? JSON.parse(raw) : null);
}
export async function downloadAttachment(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
) {
  if (request.method !== "GET") throw new HttpFailure(405);
  const q = new URL(request.url).searchParams;
  if (
    [...q.keys()].some((k) => !["issue", "id", "size"].includes(k)) ||
    ["issue", "id", "size"].some((k) => q.getAll(k).length !== 1)
  )
    throw new HttpFailure(400);
  const issue = q.get("issue")!,
    id = q.get("id")!,
    sizeText = q.get("size")!;
  if (
    !/^PMON-\d+$/.test(issue) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(id) ||
    !/^\d+$/.test(sizeText)
  )
    throw new HttpFailure(400);
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size > 50 * 1024 * 1024)
    throw new HttpFailure(413);
  await requireIssue(request, session, deps, issue);
  const metadata = await readJSON(
    request,
    session,
    deps,
    `issues/${issue}/attachments/${id}?fields=id,size,url,removed,draft`,
  );
  if (
    metadata?.id !== id ||
    metadata.size !== size ||
    metadata.removed ||
    metadata.draft ||
    typeof metadata.url !== "string"
  )
    throw new HttpFailure(409);
  const url = new URL(metadata.url, ROOT);
  if (
    url.origin !== ROOT ||
    url.username ||
    url.password ||
    url.hash ||
    /%2f|%5c|%2e/i.test(url.pathname) ||
    !/^\/(?:youtrack\/)?api\/files\/[A-Za-z0-9_./-]+$/.test(url.pathname)
  )
    throw new HttpFailure(502);
  const result = await upstream(request, session, deps, url);
  if (!result.body) throw new HttpFailure(502);
  const reader = result.body.getReader();
  let count = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        alive(request, session, deps);
        const part = await reader.read();
        alive(request, session, deps);
        if (part.done) {
          if (count !== size) throw new Error("size");
          controller.close();
          return;
        }
        count += part.value.byteLength;
        if (count > size) throw new Error("size");
        controller.enqueue(part.value);
      } catch {
        await reader.cancel().catch(() => undefined);
        controller.error(new Error("Attachment download interrupted"));
      }
    },
    async cancel() {
      await reader.cancel();
    },
  });
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
