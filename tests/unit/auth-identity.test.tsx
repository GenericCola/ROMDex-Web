import assert from "node:assert/strict";
import test from "node:test";
import { readIdentity, readProject } from "../../src/auth/identity";
import { authRequestGuard, setAuthSession } from "../../src/auth/session";
test("identity and project reads reject guest and cross-project responses", async () => {
  const original = globalThis.fetch;
  let guest = false,
    wrong = false;
  globalThis.fetch = async (url, options) => {
    assert.equal(options?.method, "GET");
    if (String(url).includes("users/me"))
      return Response.json({
        id: "1-1",
        login: guest ? "guest" : "person",
        fullName: "Fixture Person",
      });
    if (String(url).includes("admin/projects"))
      return Response.json([
        { id: "0-1", shortName: "OTHER", name: "Other project" },
      ]);
    return Response.json([
      {
        id: "3-1",
        idReadable: "OTHER-1",
        summary: "Fixture",
        description: null,
        project: { id: wrong ? "0-2" : "0-1", shortName: "OTHER" },
      },
    ]);
  };
  try {
    const identity = await readIdentity("fixture-token");
    assert.equal(identity.id, "1-1");
    const project = identity.projects[0];
    assert.ok(project);
    assert.equal((await readProject("fixture-token", project)).length, 1);
    wrong = true;
    await assert.rejects(readProject("fixture-token", project), /outside/);
    guest = true;
    await assert.rejects(readIdentity("fixture-token"), /signed-in/);
  } finally {
    globalThis.fetch = original;
  }
});
test("request captured under one account cannot dispatch after signout or account switch", () => {
  setAuthSession({
    token: "fixture-a",
    expiresAt: Date.now() + 60000,
    userId: "a",
    projectId: "p",
  });
  const check = authRequestGuard("fixture-a");
  check();
  setAuthSession(null);
  assert.throws(check, /session changed/);
  setAuthSession({
    token: "fixture-b",
    expiresAt: Date.now() + 60000,
    userId: "b",
    projectId: "p",
  });
  assert.throws(check, /session changed/);
  setAuthSession(null);
});
