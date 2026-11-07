import {
  expect as baseExpect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { createHash } from "node:crypto";
import { sha256Hex } from "../../src/store/parts/bytes.ts";
import { tooLargeMessage } from "../../src/store/parts/limits.ts";
import { attachmentName } from "../../src/store/parts/names.ts";
import { PNG } from "../fixtures/store-core-setup.tsx";
import { APP } from "./cookie-fixture";
import { desktopFixture } from "./desktop-fixture";
import {
  contentWrites,
  enforceProductionPolicy,
  newStoreHost,
  readRomdex,
  seedRomdex,
  serveStore,
  uploadsOf,
  type StoreHost,
} from "./store-fixture";
import { structuralFixture } from "./structural-fixture";

test.use({ serviceWorkers: "block" });
// Two browsers and a 2 CPU host: allow more than the 5 s default.
const expect = baseExpect.configure({ timeout: 15000 });
test.beforeEach(() => {
  test.slow();
});

const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(
    contexts.splice(0).map((context) => {
      return context.close();
    }),
  );
});

type Fixture = Awaited<ReturnType<typeof structuralFixture>>;

/** A signed-in browser on its own storage, with PMON-900002 made a parent when asked. */
const device = async (
  browser: Browser,
  host: StoreHost,
  { otherIsParent = false } = {},
) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  contexts.push(context);
  const page = await context.newPage();
  const fixture: Fixture = await structuralFixture(page);
  if (otherIsParent) {
    fixture.tasks.set("PMON-900004", {
      ...fixture.tasks.get("PMON-900003")!,
      id: "PMON-900004",
      summary: "Fixture Other Child",
      parentId: "PMON-900002",
    });
    await page.reload();
    await expect(
      page
        .getByRole("button", { name: "Expand Fixture Other", exact: true })
        .last(),
    ).toBeVisible();
  }
  // Registered last, so these routes win over the fixture's empty article list.
  await serveStore(page, host);
  return { context, page, fixture };
};

/** Two devices that each completed their first sync against one empty ROMDex store. */
const twoSyncedDevices = async (browser: Browser) => {
  const host = newStoreHost();
  await seedRomdex(host, {});
  const a = await device(browser, host, { otherIsParent: true });
  const b = await device(browser, host, { otherIsParent: true });
  await syncNow(a.page, host);
  await closeDetails(a.page);
  await syncNow(b.page, host);
  await closeDetails(b.page);
  return { host, a, b };
};

const openDetails = async (page: Page) => {
  const region = page.getByRole("region", { name: "YouTrack data sync" });
  if (!(await region.isVisible()))
    await page.getByRole("button", { name: /^Connection Details/ }).click();
  await expect(region).toBeVisible();
  return region;
};
const closeDetails = async (page: Page) => {
  if (
    !(await page
      .getByRole("region", { name: "YouTrack data sync" })
      .isVisible())
  )
    return;
  await page
    .getByRole("button", { name: "Close Connection Details", exact: true })
    .click();
};
const romdexRow = (region: Locator) => {
  return region.getByRole("listitem").filter({ hasText: /^ROMDex data:/ });
};

/** Presses Sync now and waits until that sync has run and the button is free again. */
const syncNow = async (page: Page, host: StoreHost) => {
  const region = await openDetails(page);
  const button = romdexRow(region).getByRole("button", {
    name: "Sync now",
    exact: true,
  });
  const before = host.fake.calls.length;
  await button.click();
  await expect
    .poll(() => {
      return host.fake.calls.length;
    })
    .toBeGreaterThan(before);
  await expect(button).toBeEnabled();
  return region;
};

const statusDialog = (page: Page) => {
  return page.getByRole("dialog", { name: "Set Status", exact: true });
};
const setStatus = async (page: Page, summary: string, status: string) => {
  await page
    .getByRole("button", { name: "Set Status for " + summary, exact: true })
    .last()
    .click();
  await statusDialog(page)
    .getByRole("button", { name: status, exact: true })
    .click();
  await expect(statusDialog(page)).toHaveCount(0);
};
/** The assigned status the Set Status dialog marks as current. */
const shownStatus = async (page: Page, summary: string) => {
  await page
    .getByRole("button", { name: "Set Status for " + summary, exact: true })
    .last()
    .click();
  const dialog = statusDialog(page);
  const pressed = dialog.locator("button[aria-pressed=true]");
  await expect(pressed).toHaveCount(1);
  const name = await pressed.getAttribute("aria-label");
  await dialog
    .getByRole("button", { name: /^Close/ })
    .first()
    .click();
  await expect(dialog).toHaveCount(0);
  return name;
};
const assignedInArticle = async (host: StoreHost) => {
  return (await readRomdex(host))?.metadata.assigned;
};

test("a fresh device takes YouTrack's data and overwrites none of it", async ({
  browser,
}) => {
  const host = newStoreHost();
  await seedRomdex(host, {
    assigned: { "PMON-900001": "In Development" },
    orders: { "PMON-777": ["PMON-778", "PMON-779"] },
  });
  const before = await readRomdex(host);
  const { page } = await device(browser, host);
  const region = await syncNow(page, host);
  await expect(romdexRow(region)).toContainText(
    "ROMDex data: Synced with YouTrack.",
  );
  await closeDetails(page);
  expect(await shownStatus(page, "Fixture Root")).toBe("In Development");
  const after = await readRomdex(host);
  expect(after?.metadata.assigned["PMON-900001"]).toBe("In Development");
  expect(after?.metadata.orders["PMON-777"]).toEqual(["PMON-778", "PMON-779"]);
  for (const [key, value] of Object.entries(before!.metadata.assigned))
    expect(after?.metadata.assigned[key]).toBe(value);
  expect(
    host.writes.filter((write) => {
      return write.method === "DELETE";
    }),
  ).toEqual([]);
});

test("two devices editing different keys both end up with both edits", async ({
  browser,
}) => {
  const { host, a, b } = await twoSyncedDevices(browser);

  await setStatus(a.page, "Fixture Root", "Standby");
  await syncNow(a.page, host);
  await expect
    .poll(async () => {
      return (await assignedInArticle(host))?.["PMON-900001"];
    })
    .toBe("Standby");
  await closeDetails(a.page);

  await setStatus(b.page, "Fixture Other", "In Development");
  await syncNow(b.page, host);
  await expect
    .poll(async () => {
      const assigned = await assignedInArticle(host);
      return [assigned?.["PMON-900001"], assigned?.["PMON-900002"]];
    })
    .toEqual(["Standby", "In Development"]);
  await closeDetails(b.page);

  await syncNow(a.page, host);
  await closeDetails(a.page);
  for (const { page } of [a, b]) {
    await expect
      .poll(() => {
        return shownStatus(page, "Fixture Root");
      })
      .toBe("Standby");
    await expect
      .poll(() => {
        return shownStatus(page, "Fixture Other");
      })
      .toBe("In Development");
  }
  const region = await openDetails(b.page);
  await expect(romdexRow(region)).toContainText("Synced with YouTrack.");
  await expect(
    region.getByRole("list", { name: "ROMDex data needs review" }),
  ).toHaveCount(0);
});

test("a key changed on two devices goes to review and either choice settles it", async ({
  browser,
}) => {
  const { host, a, b } = await twoSyncedDevices(browser);

  // First conflict: resolved with "Keep mine".
  await setStatus(a.page, "Fixture Root", "Standby");
  await syncNow(a.page, host);
  await expect
    .poll(async () => {
      return (await assignedInArticle(host))?.["PMON-900001"];
    })
    .toBe("Standby");
  await closeDetails(a.page);

  await setStatus(b.page, "Fixture Root", "In Development");
  let region = await syncNow(b.page, host);
  await expect(romdexRow(region)).toContainText(
    "Needs review: 1 changed on two devices.",
  );
  let review = region.getByRole("list", { name: "ROMDex data needs review" });
  await expect(review.getByRole("listitem")).toHaveCount(1);
  await expect(review).toContainText("assigned/PMON-900001");
  await expect(review).toContainText('this browser: "In Development"');
  await expect(review).toContainText('"Standby"');
  expect((await assignedInArticle(host))?.["PMON-900001"]).toBe("Standby");
  await closeDetails(b.page);
  // The notice outside the dialog and the lamp both show YouTrack's value.
  await expect(
    b.page.getByText(/ROMDex data: Needs review: 1 changed on two devices\./),
  ).toBeVisible();
  expect(await shownStatus(b.page, "Fixture Root")).toBe("Standby");

  region = await openDetails(b.page);
  await region.getByRole("button", { name: "Keep mine", exact: true }).click();
  await expect
    .poll(async () => {
      return (await assignedInArticle(host))?.["PMON-900001"];
    })
    .toBe("In Development");
  await expect(
    region.getByRole("list", { name: "ROMDex data needs review" }),
  ).toHaveCount(0);
  await expect(romdexRow(region)).toContainText("Synced with YouTrack.");
  await closeDetails(b.page);
  expect(await shownStatus(b.page, "Fixture Root")).toBe("In Development");

  // Second conflict, on another key: resolved with "Keep YouTrack's".
  await syncNow(a.page, host);
  await closeDetails(a.page);
  await setStatus(a.page, "Fixture Other", "Standby");
  await syncNow(a.page, host);
  await expect
    .poll(async () => {
      return (await assignedInArticle(host))?.["PMON-900002"];
    })
    .toBe("Standby");
  await closeDetails(a.page);

  await setStatus(b.page, "Fixture Other", "In Progress");
  region = await syncNow(b.page, host);
  await expect(romdexRow(region)).toContainText(
    "Needs review: 1 changed on two devices.",
  );
  review = region.getByRole("list", { name: "ROMDex data needs review" });
  await expect(review).toContainText("assigned/PMON-900002");
  const writesBefore = contentWrites(host).length;
  const uploadsBefore = uploadsOf(host).length;
  await region
    .getByRole("button", { name: "Keep YouTrack's", exact: true })
    .click();
  await expect(
    region.getByRole("list", { name: "ROMDex data needs review" }),
  ).toHaveCount(0);
  await expect(romdexRow(region)).toContainText("Synced with YouTrack.");
  await closeDetails(b.page);
  expect((await assignedInArticle(host))?.["PMON-900002"]).toBe("Standby");
  expect(contentWrites(host).length).toBe(writesBefore);
  expect(uploadsOf(host).length).toBe(uploadsBefore);
  expect(await shownStatus(b.page, "Fixture Other")).toBe("Standby");
});

test("offline edits wait in the browser and sync when the browser comes back online", async ({
  browser,
}) => {
  const host = newStoreHost();
  await seedRomdex(host, {});
  const { page, context } = await device(browser, host);
  await syncNow(page, host);
  await closeDetails(page);
  await setStatus(page, "Fixture Root", "Standby");
  await context.setOffline(true);
  await expect
    .poll(() => {
      return page.evaluate(() => {
        return navigator.onLine;
      });
    })
    .toBe(false);
  const writes = host.writes.length,
    calls = host.fake.calls.length;
  const region = await openDetails(page);
  await romdexRow(region)
    .getByRole("button", { name: "Sync now", exact: true })
    .click();
  await expect(romdexRow(region)).toContainText(
    "ROMDex data: Saved in this browser; waiting to sync.",
  );
  expect(host.writes.length).toBe(writes);
  expect(host.fake.calls.length).toBe(calls);
  expect((await assignedInArticle(host))?.["PMON-900001"]).not.toBe("Standby");

  await context.setOffline(false);
  await expect
    .poll(async () => {
      return (await assignedInArticle(host))?.["PMON-900001"];
    })
    .toBe("Standby");
  await expect(romdexRow(region)).toContainText(
    "ROMDex data: Synced with YouTrack.",
  );
});

test("a part over 4 MB is refused with a message while the other parts still sync", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const host = newStoreHost();
  await seedRomdex(host, {});
  const { page } = await device(browser, host);
  const bytes = new Uint8Array(4_200_000);
  for (let at = 0; at < bytes.length; at += 65536)
    crypto.getRandomValues(
      bytes.subarray(at, Math.min(bytes.length, at + 65536)),
    );
  const name = attachmentName(
    "image/PMON-900001",
    await sha256Hex(bytes),
    "raw",
    "image/png",
  );
  const message = tooLargeMessage(name, bytes.length);
  expect(message).toContain("is 4.2 MB.");

  const archive = desktopFixture();
  const file = archive.files.find((entry) => {
    return entry.name === "desktop-workspace.json";
  })!;
  const workspace = JSON.parse(
    Buffer.from(file.data, "base64").toString("utf8"),
  ) as Record<string, unknown>;
  workspace.images = {
    "PMON-900001":
      "data:image/png;base64," + Buffer.from(bytes).toString("base64"),
  };
  const raw = Buffer.from(JSON.stringify(workspace));
  file.data = raw.toString("base64");
  file.bytes = raw.length;
  file.sha256 = createHash("sha256").update(raw).digest("hex");

  // The import lives in recovery mode's workspace tools.
  await page.goto(APP + "/?recovery=1");
  await page
    .getByRole("button", {
      name: "Import Desktop or Recovery Data",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Export or recovery JSON", { exact: true })
    .setInputFiles({
      name: "big-image.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(archive)),
    });
  await expect(
    page.getByText("File verified locally. No cloud request was made.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("checkbox", {
      name: /I have preserved my current recovery copy/,
    })
    .check();
  await page
    .getByRole("button", { name: "Import Reviewed Data", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Import Desktop or Recovery Data",
      exact: true,
    }),
  ).toHaveCount(0, { timeout: 60000 });

  const region = await syncNow(page, host);
  await expect(romdexRow(region)).toContainText(
    "ROMDex data: Saved in this browser; waiting to sync.",
  );
  await expect(romdexRow(region).getByRole("alert")).toHaveText(message);
  await closeDetails(page);
  await expect(
    page.getByText(
      "ROMDex data: Saved in this browser; waiting to sync. Review",
    ),
  ).toBeVisible();
  // Nothing of the big file reached YouTrack.
  expect(
    [...host.fake.articles.values()]
      .flatMap((article) => {
        return article.attachments.map((attachment) => {
          return attachment.bytes.length;
        });
      })
      .filter((size) => {
        return size >= 4_000_000;
      }),
  ).toEqual([]);
  expect(
    uploadsOf(host).filter((write) => {
      return String((write.body as { file?: string })?.file).startsWith(
        "image",
      );
    }),
  ).toEqual([]);
  // The rest of the data still synced: the manifest moved on without the image.
  const stored = await readRomdex(host);
  expect(stored?.metadata.images).toEqual({});
  expect(stored?.revision).toBeGreaterThan(1);
});

test("Set up in YouTrack asks first, sends nothing on Cancel and creates exactly one private article", async ({
  browser,
}) => {
  const host = newStoreHost();
  const { page } = await device(browser, host);
  const region = await syncNow(page, host);
  const row = romdexRow(region);
  await expect(row).toContainText(
    'ROMDex data: Not set up: YouTrack has no "ROMDex data" article. Your data stays in this browser.',
  );
  await row.getByRole("button", { name: "Set up in YouTrack…" }).click();
  await expect(row).toContainText(
    'Create a private "ROMDex data" article in YouTrack, visible to thegobindsingh and GenericCola?',
  );
  await row.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row.getByRole("button", { name: "Create article" })).toHaveCount(
    0,
  );
  expect(host.writes).toEqual([]);

  await row.getByRole("button", { name: "Set up in YouTrack…" }).click();
  await row.getByRole("button", { name: "Create article" }).click();
  await expect(row).toContainText("ROMDex data: Synced with YouTrack.");
  const creates = host.writes.filter((write) => {
    return write.method === "POST" && write.route.startsWith("articles?");
  });
  expect(creates).toHaveLength(1);
  expect(creates[0]?.body).toMatchObject({
    summary: "ROMDex data",
    project: { id: "0-1" },
    visibility: {
      $type: "LimitedVisibility",
      permittedUsers: [{ id: "2-1" }, { id: "2-2" }],
    },
  });
  expect(
    [...host.fake.articles.values()].map((a) => {
      return a.summary;
    }),
  ).toEqual(["ROMDex data"]);
});

test("a full sync with uploads and downloads breaks no production CSP rule", async ({
  browser,
}) => {
  const host = newStoreHost();
  await seedRomdex(host, {
    assigned: { "PMON-900001": "Standby" },
    images: { "PMON-900002": PNG },
  });
  host.fake.downloads.length = 0;
  const { page } = await device(browser, host);
  const policy = await enforceProductionPolicy(page);
  await syncNow(page, host);
  await closeDetails(page);
  expect(host.fake.downloads.length).toBeGreaterThan(0);
  expect(await shownStatus(page, "Fixture Root")).toBe("Standby");
  await setStatus(page, "Fixture Root", "In Development");
  await syncNow(page, host);
  await expect
    .poll(async () => {
      return (await assignedInArticle(host))?.["PMON-900001"];
    })
    .toBe("In Development");
  expect(uploadsOf(host).length).toBeGreaterThan(0);
  expect(await policy.violations()).toEqual([]);
  // The collector works: a request outside connect-src is reported.
  await page.evaluate(() => {
    return fetch("https://outside.invalid/").catch(() => {
      return null;
    });
  });
  await expect
    .poll(() => {
      return policy.violations();
    })
    .toHaveLength(1);
});
