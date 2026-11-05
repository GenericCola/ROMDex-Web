import assert from "node:assert/strict";
import test from "node:test";
import { oauthUpstream } from "./oauth-upstream.ts";
test("public PKCE upstream discards refresh credentials and verifies nonowner projects", async () => {
  const seen: string[] = [];
  const api = oauthUpstream("public-client", async (url, init) => {
    seen.push(String(url));
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("cookie"), null);
    if (String(url).endsWith("/token")) {
      assert.equal(String(init?.body).includes("client_secret"), false);
      return Response.json({
        access_token: "synthetic-access",
        expires_in: 300,
        token_type: "Bearer",
        refresh_token: "discard-me",
      });
    }
    if (String(url).includes("/users/me"))
      return Response.json({ id: "nonowner", login: "nonowner", guest: false });
    return Response.json([
      { id: "0-2", name: "Allowed project", shortName: "OTHER" },
    ]);
  });
  assert.deepEqual(
    await api.exchange(
      "code",
      "x".repeat(43),
      "https://romdex.vercel.app/api/auth/callback",
    ),
    { accessToken: "synthetic-access", expiresIn: 300 },
  );
  assert.equal(
    (await api.verify("synthetic-access")).projects[0]?.shortName,
    "OTHER",
  );
  assert.equal(seen.length, 3);
});
test("upstream failures never expose response detail and revoked token stays rejected", async () => {
  const api = oauthUpstream(
    "public",
    async () => new Response("secret-bearing upstream text", { status: 401 }),
  );
  await assert.rejects(
    api.verify("synthetic"),
    (error) =>
      error instanceof Error &&
      error.message === "Authentication request failed",
  );
});

test("explicit offline exchange retains refresh only server-side and public refresh uses original client without adding scope", async () => {
  const bodies: URLSearchParams[] = [];
  const api = oauthUpstream("public-client", async (url, init) => {
    assert.equal(
      String(url),
      "https://thegobindsingh.youtrack.cloud/hub/api/rest/oauth2/token",
    );
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.credentials, "omit");
    assert.equal(init?.cache, "no-store");
    const body = new URLSearchParams(String(init?.body));
    bodies.push(body);
    return Response.json({
      access_token: "synthetic-only",
      expires_in: 300,
      token_type: "Bearer",
      refresh_token: "synthetic-renewal",
      scope: " YouTrack ",
    });
  });
  const tokens = await api.exchange(
    "code",
    "x".repeat(43),
    "https://romdex.vercel.app/api/auth/callback",
    true,
  );
  assert.equal(tokens.refreshToken, "synthetic-renewal");
  assert.equal(tokens.scope, "YouTrack");
  await api.refresh(tokens.refreshToken!);
  assert.equal(bodies[1]?.get("grant_type"), "refresh_token");
  assert.equal(bodies[1]?.get("client_id"), "public-client");
  assert.equal(bodies[1]?.get("refresh_token"), "synthetic-renewal");
  assert.equal(bodies[1]?.has("client_secret"), false);
  assert.equal(bodies[1]?.has("scope"), false);
});

test("malformed and broadened upstream credentials are rejected without exposing response details", async () => {
  for (const change of [
    { token_type: "other" },
    { expires_in: 0 },
    { expires_in: "300" },
    { access_token: "bad\r\nvalue" },
    { refresh_token: "" },
    { refresh_token: "bad\0value" },
    { scope: "YouTrack extra" },
    { scope: "" },
    { scope: "YouTrack\nextra" },
  ]) {
    const api = oauthUpstream("public", async () =>
      Response.json({
        access_token: "synthetic",
        expires_in: 300,
        token_type: "Bearer",
        refresh_token: "synthetic-renew",
        ...change,
      }),
    );
    await assert.rejects(
      api.refresh("synthetic-old"),
      (error) =>
        error instanceof Error &&
        error.message === "Authentication request failed",
    );
  }
});
