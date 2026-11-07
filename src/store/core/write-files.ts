import type { EncodedPart, PartValue } from "../parts/files.ts";
import { samePartValue } from "../parts/files.ts";
import type { ManifestFile } from "../parts/manifest.ts";
import type { StoreArticle } from "./article.ts";
import type { ArticleAttachment } from "./attachments.ts";
import type { StoreSnapshot } from "./read.ts";
import type { StoreTransport } from "./transport.ts";

export const sameFile = (
  a: ManifestFile | undefined,
  b: ManifestFile | undefined,
) => {
  return (
    b !== undefined &&
    a?.name === b.name &&
    a.sha256 === b.sha256 &&
    a.size === b.size &&
    a.id === b.id &&
    a.codec === b.codec &&
    a.type === b.type &&
    a.where === b.where
  );
};

export const sameFiles = (
  a: Record<string, ManifestFile>,
  b: Record<string, ManifestFile>,
) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!sameFile(a[key], b[key])) return false;
  return true;
};

/** An attachment already on the article with this part's name and size, if any. */
export const existingFile = (
  attachments: ArticleAttachment[],
  part: EncodedPart,
) => {
  return attachments.find((file) => {
    return file.name === part.name && file.size === part.size;
  });
};

export const verifiedReuse = async (
  transport: StoreTransport,
  article: StoreArticle,
  attachment: ArticleAttachment,
  part: EncodedPart,
) => {
  if (!attachment.url) return false;
  try {
    const bytes = await transport.download(attachment.url, part.size, {
      article: article.id,
      id: attachment.id,
    });
    return (
      bytes.length === part.bytes.length &&
      bytes.every((byte, index) => {
        return byte === part.bytes[index];
      })
    );
  } catch {
    // Unreadable: upload a fresh copy instead.
    return false;
  }
};

export const fileEntry = (part: EncodedPart, id: string): ManifestFile => {
  return {
    name: part.name,
    sha256: part.sha256,
    size: part.size,
    where: "youtrack",
    id,
    codec: part.codec,
    ...(part.type === undefined ? {} : { type: part.type }),
  };
};

/** Parts whose content differs from the base and so need a stored file. */
export const changedParts = (base: StoreSnapshot, parts: PartValue[]) => {
  const before = new Map(
    base.parts.map((part) => {
      return [part.key, part];
    }),
  );
  return parts.filter((part) => {
    const old = before.get(part.key);
    return !old || !samePartValue(old, part);
  });
};
