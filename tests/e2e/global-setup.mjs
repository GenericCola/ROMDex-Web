import { createPreview } from "../../scripts/serve.mjs";
export default async function setup() {
  const server = await createPreview(Number(process.env.E2E_PORT ?? 3100));
  const [serve] = server.listeners("request");
  server.removeAllListeners("request");
  const transport = async (request, response) => {
    if (request.url !== "/__attachment-transport" || request.method !== "POST") return serve(request, response);
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 65536) { response.writeHead(413); response.end(); return; }
      chunks.push(chunk);
    }
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ body: Buffer.concat(chunks).toString("base64") }));
  };
  server.on("request", transport);
  return async function teardown() {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  };
}
