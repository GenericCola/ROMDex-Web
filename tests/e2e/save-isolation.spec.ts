import { expect, test, type Page } from "@playwright/test";
import { fulfillFromOut } from "./cookie-fixture";
test.use({ serviceWorkers: "block", baseURL: "https://romdex.vercel.app" });
const content = Buffer.from("Synthetic upload recovery bytes");
const fixture = async (page: Page, lost = false, denyBytes = false) => {
  // A fresh synthetic origin serves only local exported bytes; no production request is allowed.
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://romdex.vercel.app") return route.abort();
    await fulfillFromOut(route, url);
  });
  const tasks = new Map(
    ["PMON-900001", "PMON-900002"].map((id, i) => [
      id,
      {
        id,
        idReadable: id,
        summary: i ? "Independent task" : "Upload task",
        description: "",
        updated: 1,
        parent: { issues: [] },
        project: { id: "0-1", shortName: "PMON" },
        customFields: [
          {
            id: "state",
            name: "State",
            $type: "StateIssueCustomField",
            value: { name: "To do" },
          },
        ],
        comments: [],
        commentsCount: 0,
      },
    ]),
  );
  type RemoteFile = {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    created: number;
    updated: number;
    author: { id: string };
    url: string;
  };
  const files = new Map<string, RemoteFile>();
  let posts = 0;
  await page.context().addCookies([
    {
      name: "__Host-romdex-generation",
      value: "a".repeat(43),
      url: "https://romdex.vercel.app/",
      secure: true,
      sameSite: "Lax",
    },
  ]);
  await page.route("https://thegobindsingh.youtrack.cloud/**", (route) =>
    route.abort(),
  );
  await page.route("**/api/**", async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    const reply = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.pathname === "/api/auth/session")
      return reply({
        userId: "synthetic-owner",
        projects: [{ id: "0-1", shortName: "PMON", name: "Synthetic project" }],
        csrf: "synthetic-csrf",
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
    if (url.pathname === "/api/attachment")
      return route.fulfill({
        status: denyBytes ? 503 : 200,
        contentType: "application/octet-stream",
        body: content,
      });
    const api = new URL(
      "https://fixture/" + (url.searchParams.get("route") ?? ""),
    );
    const path = api.pathname;
    if (path === "/users/me") return reply({ id: "synthetic-owner" });
    if (path === "/admin/projects")
      return reply([
        { id: "0-1", shortName: "PMON", name: "Synthetic project" },
      ]);
    if (path === "/admin/projects/0-1/customFields")
      return reply([
        {
          id: "state",
          field: { name: "State", fieldType: { id: "state[1]" } },
        },
      ]);
    if (path === "/issues") return reply([...tasks.values()]);
    const parts = path.split("/"),
      task = tasks.get(parts[2] ?? "");
    if (!task) return reply({ error: "Unknown synthetic route " + path }, 404);
    if (parts[3] === "attachments") {
      if (r.method() === "POST") {
        posts++;
        const id = "file-" + posts,
          name = posts === 2 ? "two.txt" : "one.txt";
        files.set(id, {
          id,
          name,
          size: content.length,
          mimeType: "text/plain",
          created: posts,
          updated: posts,
          author: { id: "synthetic-owner" },
          url: "/api/files/" + id,
        });
        if (lost && posts === 1) return route.abort();
        return reply([{ id }]);
      }
      return reply(
        parts[4] ? (files.get(parts[4]) ?? null) : [...files.values()],
      );
    }
    if (parts[3] === "links") return reply([]);
    if (r.method() === "POST") {
      Object.assign(task, r.postDataJSON());
      task.updated++;
      return reply({});
    }
    return reply(task);
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Upload task", exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Upload task", exact: true })
    .last()
    .press("Enter");
  await expect(
    page.getByRole("button", { name: "Attach Files", exact: true }),
  ).toBeVisible();
  return {
    tasks,
    files,
    posts: () => posts,
    allowRead: () => {
      denyBytes = false;
    },
    stage: async (names: string[]) => {
      await page
        .getByRole("button", { name: "Attach Files", exact: true })
        .click();
      await expect(
        page.getByLabel("Attach Files", { exact: true }),
      ).toBeEnabled();
      await page.getByLabel("Attach Files", { exact: true }).setInputFiles(
        names.map((name) => ({
          name,
          mimeType: "text/plain",
          buffer: content,
        })),
      );
      await expect(
        page.getByText(
          names.length +
            " files kept locally. Save Changes uploads them when delivery is connected.",
          { exact: true },
        ),
      ).toBeVisible();
      await page
        .getByRole("dialog", { name: "Attachments", exact: true })
        .getByRole("button", { name: "Close", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Attachments", exact: true }),
      ).toHaveCount(0);
    },
  };
};
test("normal pending work stays green, becomes red after ten minutes, then resets on confirmation", async ({
  page,
}) => {
  await page.clock.install();
  const f = await fixture(page);
  await page
    .getByRole("switch", { name: "Auto-Sync Data", exact: true })
    .click();
  await f.stage(["one.txt"]);
  const save = page.getByRole("button", { name: /^Save Changes/ });
  await expect(save.locator(".save-light.green")).toBeVisible();
  await page.clock.fastForward(599_000);
  await expect(save.locator(".save-light.green")).toBeVisible();
  await page.clock.fastForward(16_000);
  await expect(save.locator(".save-light.red")).toBeVisible();
  await save.click();
  await expect(
    page.getByRole("button", { name: "Cancel Upload", exact: true }),
  ).toHaveCount(0);
  await expect(save.locator(".save-light.green")).toBeVisible();
  expect(f.posts()).toBe(1);
  await page.screenshot({
    path: `artifacts/save-isolation/${test.info().project.name}-confirmed.png`,
    fullPage: true,
  });
});
test("one uncertain upload preserves multiple additions while unrelated saves and automatic recovery continue", async ({
  page,
}) => {
  await page.clock.install();
  const f = await fixture(page, true, true);
  await page
    .getByRole("switch", { name: "Auto-Sync Data", exact: true })
    .click();
  await f.stage(["one.txt", "two.txt"]);
  await page.getByRole("button", { name: /^Save Changes/ }).click();
  await expect.poll(f.posts).toBe(1);
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toBeVisible();
  expect(f.posts()).toBe(1);
  await expect(
    page.getByRole("button", { name: "Attach Files", exact: true }),
  ).toBeEnabled();
  await f.stage(["one.txt"]);
  await expect(
    page.getByRole("button", { name: "Cancel Upload", exact: true }),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "Independent task", exact: true })
    .last()
    .press("Enter");
  const notes = page.getByRole("textbox", {
    name: "Notes and Instructions",
    exact: true,
  });
  await notes.fill("Independent durable notes");
  await page.getByRole("button", { name: /^Save Changes/ }).click();
  await expect
    .poll(() => f.tasks.get("PMON-900002")?.description)
    .toBe("Independent durable notes");
  expect(f.posts()).toBe(1);
  await page
    .getByRole("button", { name: "Upload task", exact: true })
    .last()
    .press("Enter");
  await page.screenshot({
    path: `artifacts/save-isolation/${test.info().project.name}-review.png`,
    fullPage: true,
  });
  f.allowRead();
  await page
    .getByRole("switch", { name: "Auto-Sync Data", exact: true })
    .click();
  await page.clock.fastForward(61_000);
  await page.clock.runFor(2500);
  await expect(
    page.getByRole("button", { name: "Cancel Upload", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toHaveCount(0);
  expect(f.posts()).toBe(3);
  expect(f.files.size).toBe(3);
  await expect(
    page.getByRole("button", { name: "Download one.txt", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Download two.txt", exact: true }),
  ).toHaveCount(1);
});
test("reconnect checks the only uncertain upload without resending or requiring another edit", async ({
  page,
}) => {
  const f = await fixture(page, true, true);
  await page
    .getByRole("switch", { name: "Auto-Sync Data", exact: true })
    .click();
  await f.stage(["one.txt"]);
  await page.getByRole("button", { name: /^Save Changes/ }).click();
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toBeVisible();
  f.allowRead();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Upload task", exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download one.txt", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancel Upload", exact: true }),
  ).toHaveCount(0);
  expect(f.posts()).toBe(1);
});
test("server sign-in validates every selected file against 4 MB before staging any", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.getByRole("button", { name: "Attach Files", exact: true }).click();
  await page.getByLabel("Attach Files", { exact: true }).setInputFiles([
    { name: "one.txt", mimeType: "text/plain", buffer: content },
    {
      name: "large.bin",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(4_000_001),
    },
  ]);
  await expect(
    page.getByRole("status").filter({ hasText: "4 MB maximum" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel Upload", exact: true }),
  ).toHaveCount(0);
  expect(f.posts()).toBe(0);
});
for (const status of [401, 403])
  test(`post-dispatch HTTP ${status} preserves the upload and accurately reports connection state`, async ({
    page,
  }) => {
    const f = await fixture(page);
    await page
      .getByRole("switch", { name: "Auto-Sync Data", exact: true })
      .click();
    await f.stage(["one.txt"]);
    let attempts = 0;
    await page.route("**/api/youtrack?*", async (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().method() === "POST" &&
        url.searchParams.get("route")?.includes("/attachments?")
      ) {
        attempts++;
        await route.fulfill({ status, json: { error: "synthetic refusal" } });
        return;
      }
      await route.fallback();
    });
    await page.getByRole("button", { name: /^Save Changes/ }).click();
    await expect(
      page.getByRole("button", { name: "Review saved changes", exact: true }),
    ).toBeVisible();
    await expect.poll(() => attempts).toBe(1);
    if (status === 401) {
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "Sign in with YouTrack again" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: /^Auto-Sync Data. Delivery disconnected/,
        }),
      ).toBeVisible();
    } else
      await expect(
        page.getByRole("switch", { name: "Auto-Sync Data", exact: true }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel Upload", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: /^Save Changes/ }).click();
    expect(attempts).toBe(1);
  });
