import { HttpFailure, type Identity, type Tokens } from "./runtime-types.ts";
import { boundedText } from "./transport-bounds.ts";
const root = "https://thegobindsingh.youtrack.cloud";
const readTokens = (
  result: Record<string, unknown>,
  rememberDevice: boolean,
): Tokens => {
  if (
    typeof result.access_token !== "string" ||
    !result.access_token ||
    /[\r\n\0]/.test(result.access_token) ||
    typeof result.expires_in !== "number" ||
    !Number.isFinite(result.expires_in) ||
    result.expires_in <= 0 ||
    typeof result.token_type !== "string" ||
    result.token_type.toLowerCase() !== "bearer"
  )
    throw new HttpFailure(502);
  const tokens: Tokens = {
    accessToken: result.access_token,
    expiresIn: result.expires_in,
  };
  if (result.scope !== undefined) {
    if (
      typeof result.scope !== "string" ||
      !result.scope.trim() ||
      result.scope.length > 2048 ||
      /[^\x20-\x7E]/.test(result.scope)
    )
      throw new HttpFailure(502);
    tokens.scope = [...new Set(result.scope.trim().split(/ +/))]
      .sort()
      .join(" ");
    // We request one resource only. Hub may return its opaque service ID instead of its alias.
    if (tokens.scope.split(" ").length !== 1) throw new HttpFailure(502);
  }
  if (rememberDevice && result.refresh_token !== undefined) {
    if (
      typeof result.refresh_token !== "string" ||
      !result.refresh_token ||
      /[\r\n\0]/.test(result.refresh_token)
    )
      throw new HttpFailure(502);
    tokens.refreshToken = result.refresh_token;
  }
  return tokens;
};
export const oauthUpstream = (
  clientId: string,
  fetcher: typeof fetch = fetch,
) => {
  const json = async (url: string, init: RequestInit) => {
    let response: Response;
    try {
      response = await fetcher(url, {
        ...init,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new HttpFailure(503);
    }
    if (!response.ok)
      throw new HttpFailure(
        [400, 401, 403].includes(response.status) ? response.status : 503,
      );
    try {
      return JSON.parse(
        await boundedText(response.body, 1024 * 1024),
      ) as Record<string, unknown>;
    } catch {
      throw new HttpFailure(502);
    }
  };
  const exchange = async (
    code: string,
    verifier: string,
    callback: string,
    rememberDevice = false,
  ): Promise<Tokens> => {
    if (
      callback !== "https://romdex.vercel.app/api/auth/callback" ||
      !code ||
      code.length > 4096 ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)
    )
      throw new HttpFailure(400);
    const result = await json(root + "/hub/api/rest/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: verifier,
        redirect_uri: callback,
      }),
    });
    // Existing online sessions still discard unsolicited renewal authority.
    return readTokens(result, rememberDevice);
  };
  const refresh = async (refreshToken: string): Promise<Tokens> => {
    if (
      !refreshToken ||
      refreshToken.length > 8192 ||
      /[\r\n\0]/.test(refreshToken)
    )
      throw new HttpFailure(400);
    return readTokens(
      await json(root + "/hub/api/rest/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: refreshToken,
        }),
      }),
      true,
    );
  };
  const verify = async (accessToken: string): Promise<Identity> => {
    const headers = {
      Authorization: "Bearer " + accessToken,
      Accept: "application/json",
    };
    const user = await json(root + "/api/users/me?fields=id,login,guest", {
      headers,
    });
    if (
      typeof user.id !== "string" ||
      !user.id ||
      typeof user.login !== "string" ||
      !user.login ||
      user.guest === true ||
      user.login === "guest"
    )
      throw new HttpFailure(401);
    const projects: Identity["projects"] = [],
      seen = new Set<string>();
    for (let skip = 0; skip < 10000; skip += 100) {
      const values = await json(
        root +
          "/api/admin/projects?fields=id,name,shortName&$top=100&$skip=" +
          skip,
        { headers },
      );
      if (!Array.isArray(values)) throw new HttpFailure(502);
      for (const value of values) {
        if (
          !value ||
          typeof value.id !== "string" ||
          !value.id ||
          typeof value.name !== "string" ||
          typeof value.shortName !== "string" ||
          !/^[A-Za-z][A-Za-z0-9_]*$/.test(value.shortName) ||
          seen.has(value.id)
        )
          throw new HttpFailure(502);
        seen.add(value.id);
        projects.push({
          id: value.id,
          name: value.name,
          shortName: value.shortName,
        });
      }
      if (values.length < 100) return { id: user.id, guest: false, projects };
    }
    throw new HttpFailure(502);
  };
  return { exchange, refresh, verify };
};
