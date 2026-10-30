import assert from "node:assert/strict";
import test from "node:test";
import { transportRoute } from "./transport-policy.ts";
test("transport permits existing task routes but not a generic authenticated proxy", () => {
  assert.equal(
    transportRoute("users/me?fields=id", "GET").pathname,
    "/api/users/me",
  );
  assert.equal(
    transportRoute("issues/PMON-499", "DELETE").pathname,
    "/api/issues/PMON-499",
  );
  transportRoute("issues/PMON-499/links/80-1/issues", "GET");
  transportRoute(
    "admin/projects/0-1/customFields/92-1/bundle/values?fields=id,name",
    "GET",
  );
  for (const route of [
    "https://evil.test/a",
    "//evil.test/a",
    "../users/me",
    "issues/%2e%2e/users",
    "issues/PMON-1#x",
    "admin/globalSettings/restSettings",
    "hub/api/rest/users",
  ])
    assert.throws(() => transportRoute(route, "GET"));
  assert.throws(() => transportRoute("admin/projects", "POST"));
  assert.throws(() => transportRoute("issues/NPCD-1", "DELETE"));
  assert.throws(() =>
    transportRoute(
      "issues/PMON-1/extensionEndpoints/romdex-status/status/assigned",
      "POST",
    ),
  );
  assert.throws(() => transportRoute("users/me?access_token=synthetic", "GET"));
});
