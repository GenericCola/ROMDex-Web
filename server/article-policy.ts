import type { ApplicationDependencies } from "./application.ts";
import type { authorizeCookie } from "./cookie-authorize.ts";
import { HttpFailure } from "./runtime-types.ts";
import { readJSON } from "./youtrack.ts";
type Session = Awaited<ReturnType<typeof authorizeCookie>>;
export const ARTICLE_ID = /^(?:[0-9]+-[0-9]+|[A-Z][A-Z0-9_]*-A-[0-9]+)$/;
const STORE: Record<string, string> = {
  "ROMDex data": "PMON",
  "NPCDex data": "NPCD",
};
const MAX_CONTENT = 1_000_000;
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpFailure(400);
  return value as Record<string, any>;
}
function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const names = Object.keys(value);
  if (
    names.length !== expected.length ||
    names.some((k) => !expected.includes(k))
  )
    throw new HttpFailure(403);
}
function sessionProject(session: Session, shortName: string) {
  const matches = session.projects.filter((p) => p.shortName === shortName);
  if (matches.length !== 1) throw new HttpFailure(403);
  return matches[0]!;
}
function storeProjectId(session: Session, title: unknown) {
  if (typeof title !== "string" || !Object.hasOwn(STORE, title))
    throw new HttpFailure(403);
  return sessionProject(session, STORE[title]!).id;
}
export async function requireStoreArticle(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
  id: string,
) {
  if (!ARTICLE_ID.test(id)) throw new HttpFailure(403);
  const value = await readJSON(
    request,
    session,
    deps,
    `articles/${id}?fields=id,idReadable,summary,project(id,shortName)`,
  );
  if (
    !value ||
    typeof value.summary !== "string" ||
    !Object.hasOwn(STORE, value.summary) ||
    value.project?.shortName !== STORE[value.summary] ||
    value.project.id !== storeProjectId(session, value.summary)
  )
    throw new HttpFailure(403);
  return value;
}
function content(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_CONTENT)
    throw new HttpFailure(400);
}
function visibility(value: unknown) {
  const body = object(value);
  exactKeys(body, ["$type", "permittedUsers"]);
  const users = body.permittedUsers;
  if (body.$type !== "LimitedVisibility" || !Array.isArray(users))
    throw new HttpFailure(403);
  if (users.length !== 2) throw new HttpFailure(403);
  const ids = users.map(function userId(user: unknown) {
    const entry = object(user);
    exactKeys(entry, ["id"]);
    return entry.id;
  });
  if (!ids.includes("2-1") || !ids.includes("2-2") || ids[0] === ids[1])
    throw new HttpFailure(403);
}
export async function authorizeArticleWrite(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
  url: URL,
  raw: unknown,
) {
  const parts = url.pathname.slice(5).split("/");
  if (request.method !== "POST" || parts[0] !== "articles")
    throw new HttpFailure(403);
  if (parts.length === 1) {
    const body = object(raw);
    exactKeys(body, ["project", "summary", "content", "visibility"]);
    const destination = object(body.project);
    exactKeys(destination, ["id"]);
    if (destination.id !== storeProjectId(session, body.summary))
      throw new HttpFailure(403);
    content(body.content);
    visibility(body.visibility);
    return;
  }
  if (parts.length === 2) {
    await requireStoreArticle(request, session, deps, parts[1]!);
    const body = object(raw);
    exactKeys(body, ["content"]);
    content(body.content);
    return;
  }
  if (parts.length === 3 && parts[2] === "attachments") {
    await requireStoreArticle(request, session, deps, parts[1]!);
    if (raw !== undefined) throw new HttpFailure(400);
    return;
  }
  throw new HttpFailure(403);
}
