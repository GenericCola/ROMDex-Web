import assert from "node:assert/strict";
import type { ApplicationDependencies } from "./application.ts";
import { FENCE } from "./cookie-codec.ts";
/** Shaped like DevDependencies so dev tests can share it. */
export type TokenTestDependencies = ApplicationDependencies & {
  token: string;
  code: string;
  origins: string[];
};
export const fence = "f".repeat(43);
export const owner = {
  id: "owner",
  guest: false,
  projects: [{ id: "0-1", name: "PMON", shortName: "PMON" }],
};
/** Dependencies whose YouTrack accepts only "synthetic-token". */
export function tokenDeps(
  overrides: Partial<TokenTestDependencies> = {},
): TokenTestDependencies {
  return {
    key: new Uint8Array(32).fill(9),
    now: () => 1000,
    entropy: () => "e".repeat(43),
    clientId: "synthetic-client",
    maxSeconds: 3600,
    oauth: {
      exchange: async () => assert.fail("token sign-in never exchanges"),
      verify: async (token) => {
        if (token !== "synthetic-token") throw new Error("bad token");
        return owner;
      },
    },
    fetch: async () => assert.fail("no upstream call expected"),
    token: "synthetic-token",
    code: "abcdefghjk",
    origins: ["https://nextjsdev.letmecome.in", "http://localhost:3000"],
    ...overrides,
  };
}
/** A same-origin JSON POST from `origin` carrying the generation fence. */
export function post(
  url: string,
  body: string,
  origin = new URL(url).origin,
  cookie = FENCE + "=" + fence,
) {
  return new Request(url, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      cookie,
    },
    body,
  });
}
/** The cookie jar a browser would send back after `result`. */
export function jarOf(result: Response) {
  return result.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0]!)
    .join("; ");
}
