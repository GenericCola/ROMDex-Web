import { cookieFetch, isCookieHandle } from "@/auth/cookie-client";
import { authRequestGuard } from "@/auth/session";
import { YouTrackHttpError } from "./http-error";
import { YOUTRACK_ORIGIN } from "./read-tasks";
export type YouTrackRequest = (
  route: string,
  method?: string,
  body?: unknown,
  missingIsError?: boolean,
) => Promise<unknown>;
export const sessionRequest = (value: string): YouTrackRequest => {
  const token = value.trim();
  if (!token) throw Error("Enter a YouTrack token.");
  const assertSession = authRequestGuard(token);
  const request: YouTrackRequest = async (
    route,
    method = "GET",
    body,
    missingIsError = false,
  ) => {
    assertSession();
    const form = body instanceof FormData;
    const response = isCookieHandle(token)
      ? await cookieFetch(
          token,
          "/api/youtrack?route=" + encodeURIComponent(route),
          {
            method,
            headers:
              body !== undefined && !form
                ? { "Content-Type": "application/json" }
                : {},
            ...(body !== undefined
              ? { body: form ? body : JSON.stringify(body) }
              : {}),
          },
        )
      : await fetch(YOUTRACK_ORIGIN + "/api/" + route, {
          method,
          headers: {
            Authorization: "Bearer " + token,
            Accept: "application/json",
            ...(body !== undefined && !form
              ? { "Content-Type": "application/json" }
              : {}),
          },
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(30000),
          ...(body !== undefined
            ? { body: form ? body : JSON.stringify(body) }
            : {}),
        });
    assertSession();
    if (response.status === 404 && method === "GET" && !missingIsError)
      return null;
    if (!response.ok) throw new YouTrackHttpError(response.status);
    const text = await response.text();
    assertSession();
    return text ? (JSON.parse(text) as unknown) : null;
  };
  return request;
};
export const list = async <T>(
  request: YouTrackRequest,
  route: string,
  fields: string,
  query?: string,
  page = 100,
): Promise<T[]> => {
  const result: T[] = [];
  for (let skip = 0; skip < 100000; skip += page) {
    const params = new URLSearchParams({
      fields,
      $top: String(page),
      $skip: String(skip),
      ...(query ? { query } : {}),
    });
    const rows = await request(route + "?" + params.toString());
    if (!Array.isArray(rows)) throw Error("YouTrack returned an invalid list.");
    result.push(...(rows as T[]));
    if (rows.length < page) return result;
  }
  throw Error("YouTrack list exceeded its safety limit.");
};
export const issueId = (id: string) => {
  if (!/^PMON-\d+$/.test(id) || id.trim() !== id)
    throw Error("Only PMON tasks can be delivered.");
  return id;
};
