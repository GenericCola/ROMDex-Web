import type { PartValue, RefusedPart } from "../parts/files.ts";
import { encodeParts } from "../parts/files.ts";
import type {
  ManifestFile,
  ManifestSource,
  StoreManifest,
} from "../parts/manifest.ts";
import { manifestContent, readManifest } from "../parts/manifest.ts";
import { readArticle, writeArticleContent } from "./article.ts";
import { listAttachments, uploadPart } from "./attachments.ts";
import type { StoreSnapshot } from "./read.ts";
import type { StoreTransport } from "./transport.ts";
import {
  changedParts,
  existingFile,
  fileEntry,
  sameFiles,
  verifiedReuse,
} from "./write-files.ts";

/*
 * One write of a store, steps 4 to 8 of the design: encode the parts that
 * changed, upload only those (reusing an identical attachment), check that
 * nobody wrote the manifest since we read it, write the new manifest, then
 * read it back to confirm it is ours. YouTrack has no conditional write for
 * articles, so this narrows the race but cannot close it.
 */

export interface CommitInput {
  /** What the parts were merged against: manifest and decoded parts. */
  base: StoreSnapshot;
  /** The complete set of parts the store should hold after this write. */
  parts: PartValue[];
  /** YouTrack user id of the writer. */
  writtenBy: string;
  /** Set once by the migration; kept unchanged after. */
  source?: ManifestSource;
}

export type CommitResult =
  | {
      kind: "written";
      manifest: StoreManifest;
      refused: RefusedPart[];
      uploaded: string[];
      reused: string[];
    }
  /** Nothing differs from the base: nothing was sent. */
  | { kind: "unchanged"; manifest: StoreManifest; refused: RefusedPart[] }
  /** Another device wrote the manifest after we read it; the body was not written. */
  | { kind: "moved" }
  /** Our manifest was replaced right after we wrote it. */
  | { kind: "lost" };

export const commitStore = async (
  transport: StoreTransport,
  input: CommitInput,
): Promise<CommitResult> => {
  const { base, parts, writtenBy } = input;
  if (base.unavailable.length)
    throw Error(
      `Some stored parts are kept where ROMDex cannot read them (${base.unavailable.join(", ")}). Nothing was written.`,
    );
  const { article } = base;
  const { encoded, refused } = await encodeParts(changedParts(base, parts));
  const files: Record<string, ManifestFile> = {};
  for (const part of parts) {
    const kept = base.manifest.files[part.key];
    if (kept) files[part.key] = kept;
  }
  // A refused part keeps its previous stored version, if it has one.
  const source = input.source ?? base.manifest.source;
  if (
    !encoded.length &&
    sameFiles(files, base.manifest.files) &&
    JSON.stringify(source) === JSON.stringify(base.manifest.source)
  )
    return { kind: "unchanged", manifest: base.manifest, refused };
  const uploaded: string[] = [];
  const reused: string[] = [];
  if (encoded.length) {
    const attachments = await listAttachments(transport, article.id);
    for (const part of encoded) {
      const existing = existingFile(attachments, part);
      if (
        existing &&
        (await verifiedReuse(transport, article, existing, part))
      ) {
        files[part.key] = fileEntry(part, existing.id);
        reused.push(part.key);
        continue;
      }
      files[part.key] = fileEntry(
        part,
        await uploadPart(transport, article.id, part),
      );
      uploaded.push(part.key);
    }
  }
  // Uploads move the article's `updated` time, so the manifest itself is
  // compared: a write by anyone else changes its writeId.
  const current = await readArticle(transport, article.id);
  const read = current && readManifest(current.content, base.manifest.store);
  if (
    read?.kind !== "ok" ||
    read.manifest.writeId !== base.manifest.writeId ||
    read.manifest.revision !== base.manifest.revision
  )
    return { kind: "moved" };
  const manifest: StoreManifest = {
    format: "romdex-store",
    version: 1,
    store: base.manifest.store,
    revision: base.manifest.revision + 1,
    writtenAt: new Date().toISOString(),
    writtenBy,
    writeId: crypto.randomUUID(),
    files,
    ...(source ? { source } : {}),
  };
  await writeArticleContent(transport, article.id, manifestContent(manifest));
  const after = await readArticle(transport, article.id);
  const confirmed = after && readManifest(after.content, manifest.store);
  if (
    confirmed?.kind !== "ok" ||
    confirmed.manifest.writeId !== manifest.writeId
  )
    return { kind: "lost" };
  return { kind: "written", manifest, refused, uploaded, reused };
};
