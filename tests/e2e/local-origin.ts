/** The local preview the e2e suite serves `out` on. Set E2E_PORT to move it. */
export const LOCAL_PORT = Number(process.env.E2E_PORT ?? 3100);
if (!Number.isInteger(LOCAL_PORT) || LOCAL_PORT < 1 || LOCAL_PORT > 65535)
  throw Error("E2E_PORT must be a port number.");
export const LOCAL_ORIGIN = "http://127.0.0.1:" + LOCAL_PORT;
