/** Reads at most `limit` bytes; throws `exceeded()` as soon as the count passes it. */
export const boundedBytes = async (
  body: ReadableStream<Uint8Array>,
  limit: number,
  exceeded: () => Error,
) => {
  const reader = body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw exceeded();
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};
export const boundedText = async (
  body: ReadableStream<Uint8Array> | null,
  limit: number,
) => {
  if (!body) return "";
  const result = await boundedBytes(body, limit, () => {
    return Error("Payload exceeded route limit");
  });
  return new TextDecoder("utf-8", { fatal: true }).decode(result);
};
