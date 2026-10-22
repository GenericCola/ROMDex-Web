import { createPreview } from "../../scripts/serve.mjs";
export default async function setup() {
  const server = await createPreview(3100);
  return async function teardown() {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  };
}
