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
