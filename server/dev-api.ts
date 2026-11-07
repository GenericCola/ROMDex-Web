// DEVELOPMENT ONLY. `pnpm dev` starts this next to `next dev`, which forwards /api/* here.
// Listens on 127.0.0.1 only. Never prints .env values or the token.
import { existsSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { Readable } from "node:stream";
import { createDevApplication, devDependencies } from "./dev-application.ts";
if (existsSync(".env")) process.loadEnvFile(".env");
export const DEV_API_PORT = Number(process.env.ROMDEX_DEV_API_PORT ?? 3002);
const deps = devDependencies();
const handle = createDevApplication(deps);
function toRequest(incoming: IncomingMessage): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers))
    for (const item of [value ?? []].flat()) headers.append(name, item);
  const bodyless = incoming.method === "GET" || incoming.method === "HEAD";
  const init: RequestInit & { duplex: "half" } = {
    method: incoming.method ?? "GET",
    headers,
    duplex: "half",
    ...(bodyless
      ? {}
      : { body: Readable.toWeb(incoming) as ReadableStream<Uint8Array> }),
  };
  return new Request(
    "http://127.0.0.1:" + DEV_API_PORT + (incoming.url ?? "/"),
    init,
  );
}
async function serve(incoming: IncomingMessage, outgoing: ServerResponse) {
  const result = await handle(toRequest(incoming)).catch(function failed() {
    return Response.json({ error: "Dev API failed" }, { status: 502 });
  });
  const headers: Record<string, string | string[]> = {};
  result.headers.forEach(function copy(value, name) {
    if (name !== "set-cookie") headers[name] = value;
  });
  const cookies = result.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies;
  outgoing.writeHead(result.status, headers);
  if (!result.body) return void outgoing.end();
  Readable.fromWeb(
    result.body as import("node:stream/web").ReadableStream,
  ).pipe(outgoing);
}
createServer(function onRequest(incoming, outgoing) {
  void serve(incoming, outgoing);
}).listen(DEV_API_PORT, "127.0.0.1", function ready() {
  console.log(
    deps.token
      ? `Dev API on 127.0.0.1:${DEV_API_PORT}. Developer sign-in is one click.`
      : "Dev API running. YOUTRACK_TOKEN is not set, so developer sign-in is off.",
  );
});
