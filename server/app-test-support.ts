import { fixture } from "./cookie-fixture.ts";
export const origin = "https://romdex.vercel.app";
type Fixture = ReturnType<typeof fixture>;
type Project = { id: string; name: string; shortName: string };
/** Logs the cookie fixture in as `userId` with `projects` and reads its session. */
export async function signedIn(userId: string, projects: Project[]) {
  const f = fixture();
  f.deps.oauth.verify = async () => ({ id: userId, guest: false, projects });
  await f.login();
  const session = await (await f.handle(f.request("/api/auth/session"))).json();
  return { f, session };
}
/** Same-origin request builder carrying the fixture cookies and the session CSRF token. */
export function sessionRequest(f: Fixture, session: { csrf: string }) {
  return (
    path: string,
    method = "GET",
    body?: BodyInit,
    extra: Record<string, string> = {},
  ) =>
    new Request(origin + path, {
      method,
      headers: {
        cookie: [...f.jar].map(([k, v]) => `${k}=${v}`).join("; "),
        origin,
        "sec-fetch-site": "same-origin",
        "x-romdex-csrf": session.csrf,
        ...extra,
      },
      ...(body === undefined ? {} : { body }),
    });
}
