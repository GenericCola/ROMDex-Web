import assert from "node:assert/strict";
import test from "node:test";
import { preferredCookieProject } from "../../src/auth/cookie-preferences";

test("project defaults use only freshly authorized projects", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "revoked" },
  });
  const first = { id: "first", name: "First", shortName: "FIRST" };
  const second = { id: "second", name: "Second", shortName: "SECOND" };
  try {
    const identity = { id: "user", name: "User", projects: [first, second] };
    assert.equal(preferredCookieProject(identity), undefined);
    assert.equal(
      preferredCookieProject({ ...identity, projects: [first] }),
      first,
    );
    assert.equal(
      preferredCookieProject({ ...identity, projects: [] }),
      undefined,
    );
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
