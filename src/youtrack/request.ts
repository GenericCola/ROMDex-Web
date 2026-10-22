import { YOUTRACK_ORIGIN } from "./read-tasks";
export type YouTrackRequest = (
  route: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
export const sessionRequest = (value: string): YouTrackRequest => {
  const token = value.trim();
  if (!token) throw Error("Enter a YouTrack token.");
  const request: YouTrackRequest = async (route, method = "GET", body) => {
    const response = await fetch(YOUTRACK_ORIGIN + "/api/" + route, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 404 && method === "GET") return null;
    if (!response.ok)
      throw Error("YouTrack request failed (HTTP " + response.status + ").");
    const text = await response.text();
    return text ? (JSON.parse(text) as unknown) : null;
  };
  return request;
};
export const list = async <T>(
  request: YouTrackRequest,
  route: string,
  fields: string,
  query?: string,
): Promise<T[]> => {
  const result: T[] = [];
  for (let skip = 0; skip < 100000; skip += 100) {
    const params = new URLSearchParams({
      fields,
      $top: "100",
      $skip: String(skip),
      ...(query ? { query } : {}),
    });
    const page = await request(route + "?" + params.toString());
    if (!Array.isArray(page)) throw Error("YouTrack returned an invalid list.");
    result.push(...(page as T[]));
    if (page.length < 100) return result;
  }
  throw Error("YouTrack list exceeded its safety limit.");
};
export const issueId = (id: string) => {
  if (!/^PMON-\d+$/.test(id) || id.trim() !== id)
    throw Error("Only PMON tasks can be delivered.");
  return id;
};
