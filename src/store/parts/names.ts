import type { PartCodec } from "./manifest.ts";

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export const partExtension = (codec: PartCodec, type?: string): string => {
  return codec === "gzip-json"
    ? "json.gz"
    : (IMAGE_EXTENSIONS[type ?? ""] ?? "bin");
};

const slug = (key: string): string => {
  return key
    .replaceAll("/", "--")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 120);
};

export const attachmentName = (
  key: string,
  sha256: string,
  codec: PartCodec,
  type?: string,
): string => {
  return `${slug(key)}--${sha256.slice(0, 16)}.${partExtension(codec, type)}`;
};
