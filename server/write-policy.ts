import type { ApplicationDependencies } from "./application.ts";
import type { authorizeCookie } from "./cookie-authorize.ts";
import { HttpFailure } from "./runtime-types.ts";
import { readJSON } from "./youtrack.ts";
export type Session = Awaited<ReturnType<typeof authorizeCookie>>;
export function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpFailure(400);
  return value as Record<string, any>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    throw new HttpFailure(403);
}
function project(session: Session) {
  const matches = session.projects.filter((p) => p.shortName === "PMON");
  if (matches.length !== 1) throw new HttpFailure(403);
  return matches[0]!;
}
export async function requireIssue(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
  id: string,
) {
  if (!/^(?:PMON-\d+|\d+-\d+)$/.test(id)) throw new HttpFailure(403);
  const value = await readJSON(
    request,
    session,
    deps,
    `issues/${id}?fields=id,idReadable,project(id,shortName),customFields(id,name,$type)`,
  );
  if (
    !value ||
    !/^PMON-\d+$/.test(value.idReadable ?? "") ||
    value.project?.shortName !== "PMON" ||
    value.project.id !== project(session).id
  )
    throw new HttpFailure(403);
  return value;
}
export async function authorizeWrite(
  request: Request,
  session: Session,
  deps: ApplicationDependencies,
  url: URL,
  raw: unknown,
) {
  const path = url.pathname.slice(5),
    parts = path.split("/"),
    creating = path === "issues";
  let existing: any;
  if (!creating)
    existing = await requireIssue(request, session, deps, parts[1]!);
  if (request.method === "DELETE") {
    if (raw !== undefined) throw new HttpFailure(400);
    if (parts[2] === "links")
      await requireIssue(request, session, deps, parts[5]!);
    return;
  }
  if (parts[2] === "attachments") {
    if (raw !== undefined) throw new HttpFailure(400);
    return;
  }
  const body = object(raw);
  if (parts[2] === "comments") {
    keys(body, ["text"]);
    if (typeof body.text !== "string" || !body.text.trim())
      throw new HttpFailure(400);
    return;
  }
  if (parts[2] === "links" || parts[2] === "tags") {
    keys(body, ["id"]);
    if (typeof body.id !== "string" || !/^\d+-\d+$/.test(body.id))
      throw new HttpFailure(400);
    if (parts[2] === "links")
      await requireIssue(request, session, deps, body.id);
    return;
  }
  keys(
    body,
    creating
      ? ["summary", "description", "customFields", "project"]
      : ["summary", "description", "customFields"],
  );
  for (const name of ["summary", "description"])
    if (body[name] !== undefined && typeof body[name] !== "string")
      throw new HttpFailure(400);
  let fields = existing?.customFields;
  if (creating) {
    const destination = object(body.project);
    keys(destination, ["id"]);
    if (
      destination.id !== project(session).id ||
      typeof body.summary !== "string" ||
      !body.summary.trim()
    )
      throw new HttpFailure(403);
    const schema = await readJSON(
      request,
      session,
      deps,
      `admin/projects/${project(session).id}/customFields?fields=id,field(name,fieldType(id))&$top=1000`,
    );
    const types: Record<string, string> = {
      "state[1]": "StateIssueCustomField",
      "enum[1]": "SingleEnumIssueCustomField",
      "enum[*]": "MultiEnumIssueCustomField",
      "user[1]": "SingleUserIssueCustomField",
      "user[*]": "MultiUserIssueCustomField",
      date: "DateIssueCustomField",
      period: "PeriodIssueCustomField",
      integer: "SimpleIssueCustomField",
      float: "SimpleIssueCustomField",
      string: "SimpleIssueCustomField",
      text: "TextIssueCustomField",
    };
    if (!Array.isArray(schema) || schema.length >= 1000)
      throw new HttpFailure(502);
    fields = schema.map((f) => ({
      id: f.id,
      name: f.field?.name,
      $type: types[f.field?.fieldType?.id],
    }));
  }
  if (body.customFields !== undefined) {
    if (
      !Array.isArray(body.customFields) ||
      !Array.isArray(fields) ||
      body.customFields.length > 100
    )
      throw new HttpFailure(400);
    const seen = new Set();
    for (const rawField of body.customFields) {
      const field = object(rawField);
      keys(field, ["id", "name", "$type", "value"]);
      const matches = fields.filter(
        (f: any) =>
          (field.id === undefined && creating
            ? f.name === field.name
            : f.id === field.id && f.name === field.name) &&
          f.$type &&
          f.$type === field.$type,
      );
      if (matches.length !== 1 || seen.has(matches[0].id))
        throw new HttpFailure(403);
      seen.add(matches[0].id);
    }
  }
}
