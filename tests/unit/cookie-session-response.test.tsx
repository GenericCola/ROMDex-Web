import assert from "node:assert/strict";
import test from "node:test";
import { parseCookieSession } from "../../src/auth/cookie-session-response";

const session = () => ({
  userId: "user-1",
  projects: [{ id: "project-1", name: "Project", shortName: "PRJ" }],
  csrf: "csrf",
  expiresAt: Date.now() / 1000 + 300,
});

test("session parser returns only validated UI session fields and CSRF", () => {
  const value = session();
  assert.deepEqual(
    parseCookieSession({ ...value, accessToken: "must-not-be-returned" }),
    {
      csrf: value.csrf,
      expiresAt: value.expiresAt * 1000,
      identity: {
        id: value.userId,
        name: value.userId,
        projects: value.projects,
      },
      notice: "",
    },
  );
  assert.deepEqual(
    parseCookieSession({ ...value, projects: [] }).identity.projects,
    [],
  );
});

test("session parser rejects invalid identity, CSRF, project container and expiry", () => {
  for (const invalid of [
    { userId: "" },
    { userId: 1 },
    { csrf: null },
    { projects: null },
    { expiresAt: "123" },
    { expiresAt: NaN },
    { expiresAt: Infinity },
    { expiresAt: -Infinity },
    { expiresAt: 0 },
    { expiresAt: Date.now() / 1000 },
  ]) {
    assert.throws(
      () => parseCookieSession({ ...session(), ...invalid }),
      /Invalid server sign-in response/,
    );
  }
  assert.throws(() => parseCookieSession(null));
});

test("session parser rejects malformed authorized projects", () => {
  for (const project of [
    null,
    {},
    { id: 1, name: "Project", shortName: "PRJ" },
    { id: "project-1", name: null, shortName: "PRJ" },
    { id: "project-1", name: "Project", shortName: false },
  ]) {
    assert.throws(
      () => parseCookieSession({ ...session(), projects: [project] }),
      /Invalid authorized project list/,
    );
  }
});

test("session parser warns only for explicitly refused remember-device requests", () => {
  const value = session();
  assert.match(
    parseCookieSession({
      ...value,
      rememberDeviceRequested: true,
      remembered: false,
    }).notice,
    /did not allow this device/,
  );
  for (const flags of [
    { rememberDeviceRequested: false, remembered: false },
    { rememberDeviceRequested: true, remembered: true },
    { rememberDeviceRequested: true },
    { remembered: false },
    { rememberDeviceRequested: "true", remembered: false },
  ]) {
    assert.equal(parseCookieSession({ ...value, ...flags }).notice, "");
  }
});

test("invalid and stale session replies cannot replace the current CSRF", async () => {
  const { cookieSession, cookieFetch } =
    await import("../../src/auth/cookie-client");
  const prior = Object.getOwnPropertyDescriptor(globalThis, "document");
  const originalFetch = globalThis.fetch;
  const generation = "a".repeat(43);
  let cookie = "__Host-romdex-generation=" + generation;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    get: () => ({ cookie }),
  });
  try {
    globalThis.fetch = async () => Response.json(session());
    await cookieSession();
    globalThis.fetch = async () =>
      Response.json({ ...session(), csrf: "invalid", projects: [null] });
    await assert.rejects(cookieSession(), /Invalid authorized project list/);
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          cookie = "__Host-romdex-generation=" + "b".repeat(43);
          return { ...session(), csrf: "stale" };
        },
      }) as Response;
    await assert.rejects(cookieSession(), /Authentication changed/);
    cookie = "__Host-romdex-generation=" + generation;
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get("x-romdex-csrf"), "csrf");
      return Response.json({});
    };
    await cookieFetch("romdex-cookie:" + generation, "/api/youtrack");
  } finally {
    globalThis.fetch = originalFetch;
    if (prior) Object.defineProperty(globalThis, "document", prior);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
