import type { RdxInspection, RdxRequest } from "./types";
export const runRdx = (
  request: RdxRequest,
  signal?: AbortSignal,
): Promise<RdxInspection> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Error("RDX operation cancelled."));
      return;
    }
    const worker = new Worker(new URL("./rdx.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      worker.terminate();
    };
    const cancel = () => {
      finish();
      reject(Error("RDX operation cancelled."));
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        Error(
          "RDX validation exceeded 30 seconds. The source file and browser workspace are unchanged.",
        ),
      );
    }, 30000);
    signal?.addEventListener("abort", cancel, { once: true });
    worker.onmessage = (
      event: MessageEvent<{
        ok: boolean;
        result?: RdxInspection;
        error?: string;
      }>,
    ) => {
      finish();
      if (event.data.ok && event.data.result) resolve(event.data.result);
      else reject(Error(event.data.error ?? "RDX validation failed."));
    };
    worker.onerror = () => {
      finish();
      reject(Error("RDX worker failed. Keep the source file and retry."));
    };
    worker.postMessage(request);
  });
};
