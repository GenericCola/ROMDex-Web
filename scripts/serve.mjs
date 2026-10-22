import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
export const createPreview = async (port = 3000) => {
  const root = path.resolve("out");
  const policy = await readFile("public/_headers", "utf8");
  const handle = async (request, response) => {
    for (const line of policy.split("\n"))
      if (line.startsWith("  ")) {
        const colon = line.indexOf(":");
        const name = line.slice(2, colon);
        if (!["Cache-Control", "Service-Worker-Allowed"].includes(name))
          response.setHeader(name, line.slice(colon + 1).trim());
      }
    response.setHeader("Cache-Control", "no-cache");
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
      let file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep) && file !== root) {
        response.writeHead(403);
        response.end();
        return;
      }
      let status = 200;
      try {
        if ((await stat(file)).isDirectory())
          file = path.join(file, "index.html");
        await stat(file);
      } catch {
        file = path.join(root, "404.html");
        status = 404;
      }
      const bytes = await readFile(file);
      response.setHeader(
        "Content-Type",
        types[path.extname(file)] ?? "application/octet-stream",
      );
      if (pathname === "/sw.js")
        response.setHeader("Service-Worker-Allowed", "/");
      response.writeHead(status);
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      response.writeHead(400);
      response.end("Bad request");
    }
  };
  const server = http.createServer(handle);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
};
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await createPreview(Number(process.env.PORT ?? 3000));
  console.log("ROMDex preview: http://localhost:" + (process.env.PORT ?? 3000));
}
