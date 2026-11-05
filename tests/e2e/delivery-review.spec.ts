import type { WorkspaceData } from "@/domain/types";
import { expect, test, type Page } from "@playwright/test";
import {
  APP,
  installCookieFixture,
  openCookieFixture,
  routeYouTrack,
} from "./cookie-fixture";
test.use({ serviceWorkers: "block" });
const workspaceKey = JSON.stringify([
  "youtrack",
  "https://thegobindsingh.youtrack.cloud",
  "fixture-owner",
  "0-1",
]);
const storedWorkspace = async (page: Page) =>
  page.evaluate(async (key) => {
    const workspace = await new Promise<{
      keys: IDBValidKey[];
      records: { revision: number; data: WorkspaceData }[];
    }>((resolve, reject) => {
      const request = indexedDB.open("romdex-web-workspace", 1);
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction("workspace"),
          store = tx.objectStore("workspace"),
          keys = store.getAllKeys(),
          records = store.getAll();
        tx.oncomplete = () => {
          resolve({ keys: keys.result, records: records.result });
          db.close();
        };
        tx.onerror = () => reject(Error("Read failed"));
      };
      request.onerror = () => reject(Error("Open failed"));
    });
    return {
      ...workspace,
      current: workspace.records[workspace.keys.indexOf(key)]?.data,
      serialized: JSON.stringify([
        workspace,
        { ...localStorage },
        { ...sessionStorage },
      ]),
    };
  }, workspaceKey);
const fixture = async (
  page: Page,
  { comment = false, independent = false } = {},
) => {
  await installCookieFixture(page);
  const raw = {
    id: "2-test",
    idReadable: "PMON-900001",
    summary: "Synthetic review task",
    description: "Before",
    updated: 1,
    project: { id: "0-1", shortName: "PMON" },
    parent: { issues: [] },
    customFields: [],
    commentsCount: 0,
    comments: [] as {
      id: string;
      text: string;
      created: number;
      author: { login: string };
    }[],
  };
  const other = {
    ...raw,
    id: "2-other",
    idReadable: "PMON-900002",
    summary: "Independent task",
    comments: [],
  };
  const tasks = independent ? [raw, other] : [raw],
    writes: string[] = [],
    receipts: string[] = [];
  await routeYouTrack(
    page,
    "https://thegobindsingh.youtrack.cloud/api/**",
    async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname;
      const reply = async (body: unknown) => route.fulfill({ json: body });
      if (request.method() === "POST") {
        writes.push(path);
        const patch = request.postDataJSON();
        if (comment && path === "/api/issues/PMON-900001/comments") {
          raw.comments.push({
            id: "4-123",
            text: patch.text,
            created: 2,
            author: { login: "fixture" },
          });
          raw.commentsCount = raw.comments.length;
          await route.abort();
          return;
        }
        const task = tasks.find(
          (item) => path === "/api/issues/" + item.idReadable,
        );
        if (!task) throw Error("Unexpected synthetic POST " + path);
        Object.assign(task, patch);
        task.updated++;
        await reply({});
        return;
      }
      expect(request.method()).toBe("GET");
      if (path === "/api/users/me") return reply({ id: "fixture-owner" });
      if (path === "/api/admin/projects")
        return reply([{ id: "0-1", shortName: "PMON" }]);
      if (path === "/api/admin/projects/0-1/customFields") return reply([]);
      if (path === "/api/issues") return reply(tasks);
      const commentTask = tasks.find(
        (item) => path === "/api/issues/" + item.idReadable + "/comments",
      );
      if (commentTask)
        return reply(
          commentTask.comments.map((entry) => ({ ...entry, deleted: false })),
        );
      if (
        tasks.some(
          (item) => path === "/api/issues/" + item.idReadable + "/attachments",
        )
      )
        return reply([]);
      if (path === "/api/issues/PMON-900001/comments/4-123") {
        receipts.push(path);
        return reply({
          id: "4-123",
          text: raw.comments[0]?.text,
          deleted: false,
        });
      }
      const task = tasks.find(
        (item) => path === "/api/issues/" + item.idReadable,
      );
      if (task) return reply(task);
      throw Error("Unexpected synthetic GET " + path);
    },
  );
  await openCookieFixture(page);
  await page
    .getByRole("button", { name: raw.summary, exact: true })
    .last()
    .press("Enter");
  await expect(
    page.getByRole("textbox", { name: "Notes and Instructions", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(APP + "/");
  return { raw, other, writes, receipts };
};
const openReview = async (page: Page) => {
  await page
    .getByRole("button", { name: "Review saved changes", exact: true })
    .click();
  const card = page.locator(".delivery-review-card");
  await expect(card).toHaveCount(1);
  return card;
};
const closeConnection = async (page: Page) => {
  await page
    .getByRole("button", { name: "Close Connection Details", exact: true })
    .click();
};
const queueComment = async (page: Page, text: string) => {
  await page.getByRole("button", { name: "Comments", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Write a Comment", exact: true })
    .fill(text);
  await page.getByRole("button", { name: "Post Comment", exact: true }).click();
  await page
    .getByRole("button", { name: "Notes & Instructions", exact: true })
    .click();
};
for (const keepLocal of [false, true])
  test(
    "conflict review preserves local work; keepLocal=" + keepLocal,
    async ({ page }) => {
      const s = await fixture(page),
        notes = page.getByRole("textbox", {
          name: "Notes and Instructions",
          exact: true,
        });
      await notes.fill("Local");
      s.raw.description = "Remote";
      await page.getByRole("button", { name: /^Save Changes/ }).click();
      const card = await openReview(page);
      await expect(
        card.getByText(
          "This task also changed in YouTrack. Choose which version to keep.",
          { exact: true },
        ),
      ).toBeVisible();
      expect(s.writes).toEqual([]);
      await card
        .getByRole("button", {
          name: keepLocal
            ? "Use my choice: content withheld"
            : "Keep YouTrack: content withheld",
          exact: true,
        })
        .click();
      await expect(card).toHaveCount(0);
      await closeConnection(page);
      await expect(notes).toHaveValue(keepLocal ? "Local" : "Remote");
      expect(s.writes).toEqual([]);
      await page.getByRole("button", { name: /^Save Changes/ }).click();
      await expect(
        page.getByText(
          "Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.",
          { exact: true },
        ),
      ).toBeVisible();
      expect(s.writes).toEqual(keepLocal ? ["/api/issues/PMON-900001"] : []);
      expect(s.raw.description).toBe(keepLocal ? "Local" : "Remote");
      await page.reload();
      await expect(notes).toHaveValue(keepLocal ? "Local" : "Remote");
      expect(s.writes).toHaveLength(keepLocal ? 1 : 0);
    },
  );
test("an accepted comment with a lost receipt needs exact readback, never a resend", async ({
  page,
}) => {
  const s = await fixture(page, { comment: true });
  await queueComment(page, "Synthetic uncertain comment");
  await page.getByRole("button", { name: /^Save Changes/ }).click();
  const card = await openReview(page);
  await card
    .getByRole("button", { name: "Check whether this saved", exact: true })
    .click();
  await expect(
    page.getByText("Enter the exact YouTrack comment ID.", { exact: true }),
  ).toBeVisible();
  expect(s.receipts).toEqual([]);
  expect(s.writes).toEqual(["/api/issues/PMON-900001/comments"]);
  await card
    .getByLabel("Exact comment ID, if needed", { exact: true })
    .fill("4-123");
  await card
    .getByRole("button", { name: "Check whether this saved", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  expect(s.writes).toEqual(["/api/issues/PMON-900001/comments"]);
  expect(s.receipts).toEqual(["/api/issues/PMON-900001/comments/4-123"]);
  const stored = await storedWorkspace(page);
  expect(stored.keys).toEqual([workspaceKey]);
  expect(stored.current?.operations).toEqual([]);
  expect(Object.values(stored.current?.cloud?.records ?? {})).toEqual([
    expect.objectContaining({
      status: "confirmed",
      archivedOperation: expect.objectContaining({
        type: "comment",
        text: "Synthetic uncertain comment",
      }),
    }),
  ]);
  expect(stored.current?.remote[0]?.comments).toContainEqual(
    expect.objectContaining({
      id: "4-123",
      text: "Synthetic uncertain comment",
    }),
  );
  await closeConnection(page);
  await page.reload();
  await expect(
    page.getByRole("button", { name: s.raw.summary, exact: true }).last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toHaveCount(0);
  expect(s.writes).toHaveLength(1);
});
test("automatic delivery holds uncertain comments without replay while unrelated work syncs and credentials stay in memory", async ({
  page,
}) => {
  await page.clock.install();
  const s = await fixture(page, { comment: true, independent: true });
  await queueComment(page, "Automatic uncertain comment");
  const automatic = page.getByRole("switch", {
    name: "Auto-Sync Data",
    exact: true,
  });
  await automatic.click();
  await expect(automatic).toHaveAttribute("aria-checked", "true");
  await page.clock.fastForward(11000);
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Other unrelated changes can sync." }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Notes and Instructions", exact: true }),
  ).toHaveJSProperty("readOnly", true);
  await page.clock.fastForward(60000);
  expect(s.writes).toEqual(["/api/issues/PMON-900001/comments"]);
  await page
    .getByRole("button", { name: s.other.summary, exact: true })
    .last()
    .press("Enter");
  const notes = page.getByRole("textbox", {
    name: "Notes and Instructions",
    exact: true,
  });
  await expect(notes).toHaveJSProperty("readOnly", false);
  await notes.fill("Independent durable notes");
  await notes.blur();
  await page.clock.fastForward(11000);
  await expect
    .poll(() => s.other.description)
    .toBe("Independent durable notes");
  expect(s.writes).toEqual([
    "/api/issues/PMON-900001/comments",
    "/api/issues/PMON-900002",
  ]);
  await page.clock.fastForward(60000);
  expect(s.writes).toHaveLength(2);
  const stored = await storedWorkspace(page);
  expect(stored.keys).toEqual([workspaceKey]);
  expect(stored.current?.cloud?.accountId).toBe("fixture-owner");
  expect(stored.current?.operations).toEqual([
    expect.objectContaining({
      type: "comment",
      issueId: "PMON-900001",
      text: "Automatic uncertain comment",
    }),
  ]);
  expect(Object.values(stored.current?.cloud?.records ?? {})).toContainEqual(
    expect.objectContaining({ status: "uncertain" }),
  );
  for (const credential of [
    "romdex-cookie:",
    "f".repeat(43),
    "synthetic-csrf",
    "fixture-read-token",
    "fixture-delivery-token",
  ])
    expect(stored.serialized).not.toContain(credential);
  const card = await openReview(page);
  await card
    .getByRole("button", {
      name: "Keep YouTrack; archive pending change",
      exact: true,
    })
    .click();
  await expect(card).toHaveCount(0);
  await closeConnection(page);
  await page.clock.fastForward(60000);
  expect(s.writes).toHaveLength(2);
  await page.reload();
  await expect(notes).toHaveValue("Independent durable notes");
  expect(s.writes).toHaveLength(2);
});
test("connection reading waits for a delayed browser workspace before adopting tasks", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open,
      delays = { pending: 0, completed: 0 };
    (
      window as Window & { workspaceOpenDelays?: typeof delays }
    ).workspaceOpenDelays = delays;
    IDBFactory.prototype.open = function (name, version) {
      const request =
        version === undefined
          ? open.call(this, name)
          : open.call(this, name, version);
      if (name === "romdex-web-workspace") {
        let held = false;
        request.addEventListener("success", (event) => {
          if (held) return;
          held = true;
          delays.pending++;
          event.stopImmediatePropagation();
          setTimeout(() => {
            delays.pending--;
            delays.completed++;
            request.dispatchEvent(new Event("success"));
          }, 1500);
        });
      }
      return request;
    };
  });
  const ready = fixture(page);
  await page.waitForURL(APP + "/");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { workspaceOpenDelays?: { pending: number } })
            .workspaceOpenDelays?.pending ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Synthetic review task", exact: true }),
  ).toHaveCount(0);
  await ready;
  await expect(
    page
      .getByRole("button", { name: "Synthetic review task", exact: true })
      .last(),
  ).toBeVisible();
  await expect(
    page.getByText("Wait for your workspace to open.", { exact: true }),
  ).toHaveCount(0);
  const delays = await page.evaluate(
    () =>
      (
        window as Window & {
          workspaceOpenDelays?: { pending: number; completed: number };
        }
      ).workspaceOpenDelays,
  );
  expect(delays?.pending).toBe(0);
  expect(delays?.completed).toBeGreaterThanOrEqual(1);
});
