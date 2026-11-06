const BASE64_TEXT = /^[A-Za-z0-9+/]*={0,2}$/;
const IMAGE_DATA_URL =
  /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

export interface DataUrlImage {
  type: string;
  bytes: Uint8Array;
}

const toBuffer = (bytes: Uint8Array): ArrayBuffer => {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", toBuffer(bytes));
  return Array.from(new Uint8Array(digest), (byte) => {
    return byte.toString(16).padStart(2, "0");
  }).join("");
};

const pipeBytes = async (
  bytes: Uint8Array,
  transform: CompressionStream | DecompressionStream,
  maxBytes: number,
): Promise<Uint8Array> => {
  const input = new Blob([toBuffer(bytes)]).stream();
  const reader = input.pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Data is larger than ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
};

export const gzipBytes = (bytes: Uint8Array): Promise<Uint8Array> => {
  return pipeBytes(
    bytes,
    new CompressionStream("gzip"),
    Number.MAX_SAFE_INTEGER,
  );
};

export const gunzipBytes = (
  bytes: Uint8Array,
  maxBytes: number,
): Promise<Uint8Array> => {
  return pipeBytes(bytes, new DecompressionStream("gzip"), maxBytes);
};

export const utf8 = (text: string): Uint8Array => {
  return new TextEncoder().encode(text);
};

export const fromUtf8 = (bytes: Uint8Array): string => {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
};

export const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let at = 0; at < bytes.length; at += 8192)
    binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
  return btoa(binary);
};

export const fromBase64 = (text: string): Uint8Array => {
  if (!BASE64_TEXT.test(text) || text.length % 4 !== 0)
    throw new Error("Invalid base64.");
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at++) bytes[at] = binary.charCodeAt(at);
  if (toBase64(bytes) !== text) throw new Error("Invalid base64.");
  return bytes;
};

export const parseImageDataUrl = (value: string): DataUrlImage | null => {
  const match = IMAGE_DATA_URL.exec(value);
  const type = match?.[1];
  const text = match?.[2];
  if (type === undefined || text === undefined) return null;
  try {
    return { type, bytes: fromBase64(text) };
  } catch {
    return null;
  }
};

export const imageDataUrl = (image: DataUrlImage): string => {
  return `data:${image.type};base64,${toBase64(image.bytes)}`;
};

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => {
        return a < b ? -1 : a > b ? 1 : 0;
      })
      .map(([key, item]) => {
        return [key, sortKeys(item)];
      }),
  );
};

export const stableJson = (value: unknown): string => {
  return JSON.stringify(sortKeys(value));
};
