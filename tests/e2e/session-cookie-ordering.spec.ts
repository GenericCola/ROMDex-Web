import { expect, test } from "@playwright/test";
import { FENCE, RENEWAL, SESSION } from "../../server/cookie-codec";
import { HttpFailure } from "../../server/runtime-types";
import { durableCookieFixture } from "./durable-cookie-fixture";

test.use({ serviceWorkers: "block" });

test("browser accepts encrypted HttpOnly cookies; late renewal after completed different-account login fails closed", async ({
  page,
}) => {
  const f = await durableCookieFixture(page);
  await f.login();
  for (const name of [SESSION, RENEWAL]) {
    expect(await f.cookie(name)).toMatchObject({
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "Lax",
    });
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      name + "=",
    );
  }
  f.advance(600);
  const challenge = (await f.call("/api/auth/session")).body;
  let release!: () => void;
  let started = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.deps.oauth.refresh = async () => {
    started = true;
    await gate;
    return {
      accessToken: "late-owner-access",
      expiresIn: 300,
      refreshToken: "late-owner-refresh",
    };
  };
  const pending = f.call(
    "/api/auth/renew",
    { renewalId: challenge.renewalId },
    challenge.csrf,
  );
  await expect.poll(() => started).toBe(true);
  await f.login("different-account");
  const fence = (await f.cookie(FENCE))!.value;
  expect((await f.envelope(SESSION)).userId).toBe("different-account");
  release();
  expect((await pending).status).toBe(200);
  expect((await f.cookie(FENCE))!.value).toBe(fence);
  expect((await f.envelope(SESSION)).userId).toBe("fixture-owner");
  const read = await f.call("/api/auth/session");
  expect(read.status).toBe(401);
  expect(read.body.renewable).toBeUndefined();
});

test("browser applies concurrent renewal responses in reverse arrival order with bounded stale-token fallback", async ({
  page,
}) => {
  const f = await durableCookieFixture(page);
  await f.login();
  const original = await f.envelope(RENEWAL);
  f.advance(600);
  const challenge = (await f.call("/api/auth/session")).body;
  const releases: Array<() => void> = [];
  let count = 0;
  f.deps.oauth.refresh = async () => {
    const index = count++;
    await new Promise<void>((resolve) => {
      releases[index] = resolve;
    });
    return {
      accessToken: "synthetic-concurrent-" + index,
      expiresIn: 300,
      refreshToken: "synthetic-rotation-" + index,
    };
  };
  const renew = () =>
    f.call(
      "/api/auth/renew",
      { renewalId: challenge.renewalId },
      challenge.csrf,
    );
  const first = renew();
  await expect.poll(() => count).toBe(1);
  const second = renew();
  await expect.poll(() => count).toBe(2);
  releases[1]!();
  expect((await second).status).toBe(200);
  expect((await f.envelope(RENEWAL)).refreshToken).toBe("synthetic-rotation-1");
  releases[0]!();
  expect((await first).status).toBe(200);
  expect(await f.envelope(RENEWAL)).toMatchObject({
    refreshToken: "synthetic-rotation-0",
    userId: original.userId,
    fence: original.fence,
    sessionId: original.sessionId,
    expiresAt: original.expiresAt,
  });
  expect((await f.call("/api/auth/session")).status).toBe(200);
  f.advance(300);
  const next = (await f.call("/api/auth/session")).body;
  f.deps.oauth.refresh = async () => {
    count++;
    throw new HttpFailure(400);
  };
  const before = await f.cookie(RENEWAL);
  expect(
    (await f.call("/api/auth/renew", { renewalId: next.renewalId }, next.csrf))
      .status,
  ).toBe(400);
  expect((await f.cookie(RENEWAL))!.value).toBe(before!.value);
  expect(count).toBe(3);
});

for (const rejected of [SESSION, RENEWAL])
  test(
    "browser rejects one invalid __Host cookie during renewal: " + rejected,
    async ({ page }) => {
      const f = await durableCookieFixture(page);
      await f.login();
      const originalAccess = (await f.cookie(SESSION))!.value;
      const originalRenewal = (await f.cookie(RENEWAL))!.value;
      f.advance(600);
      const challenge = (await f.call("/api/auth/session")).body;
      f.reject(rejected);
      expect(
        (
          await f.call(
            "/api/auth/renew",
            { renewalId: challenge.renewalId },
            challenge.csrf,
          )
        ).status,
      ).toBe(200);
      const access = (await f.cookie(SESSION))!.value,
        renewal = (await f.cookie(RENEWAL))!.value;
      expect(access === originalAccess).toBe(rejected === SESSION);
      expect(renewal === originalRenewal).toBe(rejected === RENEWAL);
      expect(
        (await page.context().cookies()).some((c) => c.path === "/rejected"),
      ).toBe(false);
      const read = await f.call("/api/auth/session");
      if (rejected === SESSION) {
        expect(read.status).toBe(401);
        // Rotated envelope says access is still live: missing access must not burn
        // another refresh credential or falsely open the workspace.
        expect(read.body.renewable).toBeUndefined();
      } else {
        expect(read.status).toBe(200);
        expect(read.body.userId).toBe("fixture-owner");
        f.advance(300);
        expect((await f.call("/api/auth/session")).status).toBe(401);
      }
    },
  );
