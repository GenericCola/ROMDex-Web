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
test("transport permits the two store article routes and nothing else on articles", () => {
  for (const route of [
    "articles?fields=id&query=project:PMON&$top=5",
    "articles/186-6?fields=id,content",
    "articles/PMON-A-12",
    "articles/186-6/attachments?fields=id",
    "articles/186-6/attachments/1-2",
  ])
    assert.equal(
      transportRoute(route, "GET").pathname.slice(0, 13),
      "/api/articles",
    );
  for (const route of [
    "articles",
    "articles/186-6",
    "articles/PMON-A-12/attachments",
  ])
    transportRoute(route, "POST");
  for (const [route, method] of [
    ["articles/186-6", "DELETE"],
    ["articles/186-6/attachments/1-2", "DELETE"],
    ["articles/186-6/comments", "POST"],
    ["articles/186-6/comments", "GET"],
    ["articles/%2e%2e", "GET"],
    ["articles/../users/me", "GET"],
    ["articles/pmon-a-1", "GET"],
    ["articles/186-6/attachments/1-2", "POST"],
    ["articles/186-6?access_token=x", "GET"],
  ] as const)
    assert.throws(() => transportRoute(route, method), route + " " + method);
});
