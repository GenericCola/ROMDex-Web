import type { ManifestRead } from "../parts/manifest.ts";
import {
  emptyManifest,
  manifestContent,
  readManifest,
} from "../parts/manifest.ts";
import type { StoreTarget, StoreTransport } from "./transport.ts";

/*
 * The store's article: find it, create it, read and write its body, and list
 * and upload its attachments. Nothing here deletes anything.
 */

export interface StoreArticle {
  id: string;
  idReadable: string;
  summary: string;
  content: string;
  updated: number;
  projectId: string;
}

const ARTICLE_FIELDS = "id,idReadable,summary,content,updated,project(id)";

export const articleId = (id: string) => {
  if (!/^(?:\d+-\d+|[A-Z][A-Z0-9_]*-A-\d+)$/.test(id))
    throw Error("Invalid article id.");
  return id;
};

export const record = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const toArticle = (value: unknown): StoreArticle => {
  const raw = record(value);
  const project = record(raw?.project);
  if (
    typeof raw?.id !== "string" ||
    typeof raw.summary !== "string" ||
    typeof raw.updated !== "number" ||
    typeof project?.id !== "string"
  )
    throw Error("YouTrack returned an unreadable article.");
  return {
    id: raw.id,
    idReadable: typeof raw.idReadable === "string" ? raw.idReadable : raw.id,
    summary: raw.summary,
    content: typeof raw.content === "string" ? raw.content : "",
    updated: raw.updated,
    projectId: project.id,
  };
};

export const readArticle = async (
  transport: StoreTransport,
  id: string,
): Promise<StoreArticle | null> => {
  const value = await transport.request(
    `articles/${articleId(id)}?fields=${ARTICLE_FIELDS}`,
  );
  return value === null ? null : toArticle(value);
};

/** A manifest this store can use, or one written by a newer app. */
const usable = (read: ManifestRead) => {
  return read.kind === "ok" || read.kind === "newer";
};

const matches = (target: StoreTarget, article: StoreArticle) => {
  return (
    article.summary === target.title &&
    article.projectId === target.projectId &&
    usable(readManifest(article.content, target.store))
  );
};

export type FindResult =
  | { kind: "found"; article: StoreArticle }
  | { kind: "missing" }
  | { kind: "ambiguous"; ids: string[] };

/**
 * The store's article: the cached id first, else an exact title match in the
 * right project with a manifest for this store. Two matches are never chosen
 * between silently, because two stores would split the data.
 */
export const findArticle = async (
  transport: StoreTransport,
  target: StoreTarget,
  cachedId?: string,
): Promise<FindResult> => {
  if (cachedId) {
    const cached = await readArticle(transport, cachedId);
    if (cached && matches(target, cached))
      return { kind: "found", article: cached };
  }
  const params = new URLSearchParams({
    query: `{${target.title}}`,
    fields: ARTICLE_FIELDS,
    $top: "100",
  });
  const found = await transport.request(`articles?${params.toString()}`);
  if (!Array.isArray(found)) throw Error("YouTrack returned an invalid list.");
  const candidates = found.map(toArticle).filter((article) => {
    return matches(target, article);
  });
  const [only] = candidates;
  if (!only) return { kind: "missing" };
  if (candidates.length > 1)
    return {
      kind: "ambiguous",
      ids: candidates.map((article) => {
        return article.idReadable;
      }),
    };
  return { kind: "found", article: only };
};

/**
 * Creates the store's article, visible only to the permitted users, with an
 * empty manifest. Browsers call this only after the user confirms.
 */
export const createArticle = async (
  transport: StoreTransport,
  target: StoreTarget,
  writtenBy: string,
): Promise<StoreArticle> => {
  const manifest = emptyManifest(
    target.store,
    writtenBy,
    crypto.randomUUID(),
    new Date().toISOString(),
  );
  const created = await transport.request(
    `articles?fields=${ARTICLE_FIELDS}`,
    "POST",
    {
      project: { id: target.projectId },
      summary: target.title,
      content: manifestContent(manifest),
      visibility: {
        $type: "LimitedVisibility",
        permittedUsers: target.permittedUsers.map((id) => {
          return { id };
        }),
      },
    },
  );
  return toArticle(created);
};

export const writeArticleContent = async (
  transport: StoreTransport,
  id: string,
  content: string,
) => {
  await transport.request(`articles/${articleId(id)}?fields=id`, "POST", {
    content,
  });
};
