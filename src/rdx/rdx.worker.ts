import { inspectRdx } from "./inspect";
import type { RdxRequest } from "./types";
self.onmessage = async (event: MessageEvent<RdxRequest>) => {
  try {
    const result = await inspectRdx(event.data);
    self.postMessage({ ok: true, result }, { transfer: [result.bytes.buffer] });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "RDX validation failed.",
    });
  }
};
