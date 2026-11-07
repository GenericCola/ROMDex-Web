import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { APP, routeYouTrack } from "./cookie-fixture";
import { addTask, structuralFixture } from "./structural-fixture";
test.use({ serviceWorkers: "block" });
const content = Buffer.from("ROMDex attachment: durable bytes \u00e9\n");
const attachmentFixture = async (
  page: Page,
  mode: "normal" | "lost-upload" | "lost-delete" = "normal",
) => {
  const nativeWire = ["webkit", "iphone"].includes(test.info().project.name);
  if (nativeWire)
    await page.addInitScript(() => {
      const send = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        if (
          decodeURIComponent(String(input)).includes("/attachments?") &&
          init?.method === "POST" &&
          init.body instanceof FormData
        ) {
          const encoded = new Request(
            new URL("/__attachment-transport", location.href),
            { method: "POST", body: init.body },
          );
          const response = await send("/__attachment-transport", {
            method: "POST",
            headers: encoded.headers,
            body: await encoded.arrayBuffer(),
          });
          const { body } = await response.json();
          const text = new TextDecoder().decode(
            Uint8Array.from(atob(body), (c) => c.charCodeAt(0)),
          );
          if (
            !text.includes("ROMDex attachment: durable bytes \u00e9\n") ||
            !text.includes('filename="fixture.txt"')
          )
            throw Error("Native attachment multipart bytes differ.");
        }
        return send(input, init);
      };
    });
  const s = await structuralFixture(page);
  await page
    .getByRole("button", { name: "Fixture Root", exact: true })
    .last()
    .click();
  const files = new Map<
    string,
    {
      id: string;
      name: string;
      size: number;
      mimeType: string;
      created: number;
      updated: number;
      author: { id: string };
      url: string;
    }
  >();
  let uploads = 0,
    deletions = 0,
    lost = false;
  await routeYouTrack(
    page,
    "https://thegobindsingh.youtrack.cloud/api/files/**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        body: content,
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );
  await routeYouTrack(
    page,
    "https://thegobindsingh.youtrack.cloud/api/issues/*/attachments**",
    async (route) => {
      const r = route.request(),
        u = new URL(r.url()),
        parts = u.pathname.split("/"),
        id = parts[3]!,
        fileId = parts[5],
        method = r.method(),
        headers = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization,accept,content-type",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        };
      const reply = async (body: unknown, status = 200) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers });
        return;
      }
      expect(id).toMatch(/^PMON-/);
      if (method === "GET") {
        await reply(
          fileId ? (files.get(fileId) ?? null) : [...files.values()],
          fileId && !files.has(fileId) ? 404 : 200,
        );
        return;
      }
      if (method === "POST") {
        expect(r.headers()["content-type"]).toContain(
          "multipart/form-data; boundary=",
        );
        const body = r.postDataBuffer()!;
        if (!nativeWire) expect(body.includes(content)).toBe(true);
        expect(body.toString()).toContain('filename="fixture.txt"');
        const key = "134-" + ++uploads;
        files.set(key, {
          id: key,
          name: "fixture.txt",
          size: content.length,
          mimeType: "text/plain",
          created: 1,
          updated: 1,
          author: { id: "fixture-owner" },
          url: "/api/files/" + key,
        });
        s.tasks.get(id)!.updated++;
        if (mode === "lost-upload" && !lost) {
          lost = true;
          await route.abort();
          return;
        }
        await reply([{ id: key }]);
        return;
      }
      if (method === "DELETE") {
        expect(fileId).toBe("134-1");
        deletions++;
        files.delete(fileId!);
        s.tasks.get(id)!.updated++;
        if (mode === "lost-delete" && !lost) {
          lost = true;
          await route.abort();
          return;
        }
        await route.fulfill({ status: 204, headers });
        return;
      }
      throw Error("Unexpected attachment request " + method + " " + u.pathname);
    },
  );
  const stage = async () => {
    await page
      .getByRole("button", { name: "Attach Files", exact: true })
      .click();
    await expect(
      page.getByLabel("Attach Files", { exact: true }),
    ).toBeEnabled();
    await page.getByLabel("Attach Files", { exact: true }).setInputFiles({
      name: "fixture.txt",
      mimeType: "text/plain",
      buffer: content,
    });
    await expect(
      page.getByText(
        "1 files kept locally. Save Changes uploads them when delivery is connected.",
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole("dialog", { name: "Attachments", exact: true })
      .getByRole("button", { name: "Close", exact: true })
      .click();
  };
  return {
    ...s,
    files,
    stage,
    uploads: () => uploads,
    deletions: () => deletions,
  };
};

const openAttachDialog = async (page: Page) => {
  await page.getByRole("button", { name: "Attach Files", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Attachments", exact: true })
      .getByRole("status")
      .filter({ hasText: "0 attachments read" }),
  ).toBeVisible();
  await expect(page.getByLabel("Attach Files", { exact: true })).toBeEnabled();
};
const queueFixtureDeletion = async (page: Page) => {
  await page
    .getByRole("button", { name: "Delete fixture.txt", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Queue Attachment Deletion", exact: true })
    .click();
};
test("attachments stage offline, survive reload, download exact bytes and delete only after reviewed Save", async ({
  page,
}) => {
  const s = await attachmentFixture(page);
  await s.stage();
  expect(s.uploads()).toBe(0);
  const legacy = ["chromium", "firefox"].includes(test.info().project.name);
  await page.evaluate(async (legacy) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("romdex-web-upload-bytes", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("files", legacy ? "readwrite" : "readonly"),
          store = tx.objectStore("files"),
          r = store.getAll();
        r.onsuccess = () => {
          const value = r.result[0];
          if (!(value.bytes instanceof ArrayBuffer) || value.blob) {
            tx.abort();
            return;
          }
          if (legacy)
            store.put(
              {
                id: value.id,
                scope: value.scope,
                file: value.file,
                blob: new Blob([value.bytes], { type: value.file.mimeType }),
              },
              value.scope === undefined ? value.id : [value.scope, value.id],
            );
        };
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(
            Error(
              "Expected a portable byte record before legacy compatibility check.",
            ),
          );
      });
    } finally {
      db.close();
    }
  }, legacy);
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Item Attachments", exact: true })
      .getByRole("button", { name: "Download", exact: true }),
  ).toBeVisible();
  const saved = page.waitForEvent("download");
  await page
    .getByRole("region", { name: "Item Attachments", exact: true })
    .getByRole("button", { name: "Download", exact: true })
    .click();
  const local = await saved;
  expect(await readFile((await local.path())!)).toEqual(content);
  await s.connect();
  await page.getByRole("button", { name: "Attach Files", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh Attachments", exact: true })
    .click();
  await expect(
    page.getByText("0 attachments read. No file mutation was sent.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Attachments", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await s.save();
  await s.confirmed();
  expect(s.uploads()).toBe(1);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download fixture.txt", exact: true })
    .click();
  expect(await readFile((await (await download).path())!)).toEqual(content);
  await page
    .getByRole("button", { name: "Delete fixture.txt", exact: true })
    .click();
  await page
    .getByRole("dialog", {
      name: "Queue deletion of this attachment?",
      exact: true,
    })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  expect(s.deletions()).toBe(0);
  await queueFixtureDeletion(page);
  await expect(
    page.getByText(
      "Attachment deletion queued. Connected Save Changes sends the reviewed request.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(s.deletions()).toBe(0);
  await s.save();
  await s.confirmed();
  expect(s.deletions()).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Download fixture.txt", exact: true }),
  ).toHaveCount(0);
});

test("lost upload automatically verifies exact bytes and survives restart without resending", async ({
  page,
}) => {
  const s = await attachmentFixture(page, "lost-upload");
  await s.stage();
  await s.connect();
  await s.save();
  await s.confirmed();
  expect(s.uploads()).toBe(1);
  await page.reload();
  await s.connect();
  await expect(
    page.getByRole("button", { name: "Download fixture.txt", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toHaveCount(0);
  await s.save();
  await s.confirmed();
  expect(s.uploads()).toBe(1);
});

test("a file queued for a newly created task follows the exact returned PMON identity", async ({
  page,
}) => {
  const s = await attachmentFixture(page);
  await addTask(page, "Task with file");
  await s.stage();
  await s.connect();
  await s.save();
  await s.confirmed();
  expect(s.tasks.get("PMON-900101")?.summary).toBe("Task with file");
  expect(s.uploads()).toBe(1);
  await expect(
    page.getByRole("button", { name: "Download fixture.txt", exact: true }),
  ).toBeVisible();
});

test("oversized file selection shows the actual tenant limit without queuing or uploading", async ({
  page,
}) => {
  const s = await attachmentFixture(page);
  await openAttachDialog(page);
  await page.getByLabel("Attach Files", { exact: true }).setInputFiles({
    name: "too-large.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText(
      "YouTrack accepts files up to 10 MiB. No upload was sent. Keep the original file.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(s.uploads()).toBe(0);
  await expect(
    page.getByRole("button", { name: "Cancel Upload", exact: true }),
  ).toHaveCount(0);
});

test("lost deletion stays blocked until exact missing-file acknowledgement, without a second DELETE", async ({
  page,
}) => {
  const s = await attachmentFixture(page, "lost-delete");
  await s.stage();
  await s.connect();
  await s.save();
  await s.confirmed();
  await queueFixtureDeletion(page);
  await s.save();
  await s.uncertain();
  expect(s.deletions()).toBe(1);
  await page.reload();
  await s.connect();
  await page.getByRole("button", { name: /^Connection Details/ }).click();
  const confirm = page.getByRole("button", {
    name: "Check whether this saved",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await page
    .getByRole("button", { name: "Read Current Attachment IDs", exact: true })
    .click();
  await expect(
    page.getByText(
      "Current attachment IDs read. No upload or deletion was resent.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: /I checked 134-1 in YouTrack/ })
    .check();
  await confirm.click();
  await expect(page.locator(".delivery-review-card")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close Connection Details", exact: true })
    .click();
  await s.save();
  await s.confirmed();
  expect(s.deletions()).toBe(1);
});

test("changed deletion metadata selects the conflict message and sends no DELETE", async ({
  page,
}) => {
  const s = await attachmentFixture(page);
  await s.stage();
  await s.connect();
  await s.save();
  await s.confirmed();
  await queueFixtureDeletion(page);
  s.files.get("134-1")!.updated++;
  await s.save();
  await expect(
    page.getByRole("button", { name: "Review saved changes", exact: true }),
  ).toBeVisible();
  expect(s.deletions()).toBe(0);
  await page.getByRole("button", { name: /^Connection Details/ }).click();
  await expect(page.locator(".delivery-review-card")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check whether this saved", exact: true }),
  ).toBeDisabled();
});

test("recovery imports exact staged bytes into a separate browser workspace with delivery disconnected", async ({
  page,
  browser,
}) => {
  const s = await attachmentFixture(page);
  await s.stage();
  await page.goto(APP + "/?recovery=1");
  await expect(
    page.getByRole("button", { name: "Export Recovery Copy", exact: true }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Recovery Copy", exact: true })
    .click();
  const bytes = await readFile((await (await pending).path())!);
  const root = JSON.parse(bytes.toString());
  expect(Buffer.from(root.uploads[0].data, "base64")).toEqual(content);
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const other = await context.newPage();
    await structuralFixture(other);
    await other.goto(APP + "/?recovery=1");
    await expect(
      other.getByRole("button", {
        name: "Import Desktop or Recovery Data",
        exact: true,
      }),
    ).toBeVisible();
    let requests = 0;
    let revalidatingSignIn = false;
    let mutations = 0;
    await other.route(APP + "/api/youtrack?*", async (route) => {
      if (revalidatingSignIn && route.request().method() === "GET")
        return route.fallback();
      if (revalidatingSignIn) mutations++;
      else requests++;
      await route.abort();
    });
    await other
      .getByRole("button", {
        name: "Import Desktop or Recovery Data",
        exact: true,
      })
      .click();
    await other
      .getByLabel("Export or recovery JSON", { exact: true })
      .setInputFiles({
        name: "recovery.json",
        mimeType: "application/json",
        buffer: bytes,
      });
    await expect(
      other.getByText("File verified locally. No cloud request was made.", {
        exact: true,
      }),
    ).toBeVisible();
    await other
      .getByRole("checkbox", {
        name: /I have preserved my current recovery copy/,
      })
      .check();
    expect(requests).toBe(0);
    revalidatingSignIn = true;
    await other
      .getByRole("button", { name: "Import Reviewed Data", exact: true })
      .click();
    await expect(
      other.getByRole("dialog", {
        name: "Import Desktop or Recovery Data",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(requests).toBe(0);
    revalidatingSignIn = true;
    await other.reload();
    await expect(
      other.getByRole("button", { name: /^Save Changes/ }),
    ).toBeVisible();
    const local = other.waitForEvent("download");
    await other
      .getByRole("region", { name: "Item Attachments", exact: true })
      .getByRole("button", { name: "Download", exact: true })
      .click();
    expect(await readFile((await (await local).path())!)).toEqual(content);
    await other.getByRole("button", { name: /^Save Changes/ }).click();
    expect(requests).toBe(0);
    expect(mutations).toBe(0);
    expect(s.uploads()).toBe(0);
  } finally {
    await context.close();
  }
});

test("failed staged-file storage shows refusal and queues no upload", async ({
  page,
}) => {
  const s = await attachmentFixture(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const r =
        key === undefined ? put.call(this, value) : put.call(this, value, key);
      if (this.name === "files") this.transaction.abort();
      return r;
    };
  });
  await openAttachDialog(page);
  await page.getByLabel("Attach Files", { exact: true }).setInputFiles({
    name: "fixture.txt",
    mimeType: "text/plain",
    buffer: content,
  });
  await expect(
    page.getByRole("status").filter({
      hasText: "Staged file could not be saved. Keep the original file.",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Item Attachments", exact: true })
      .getByRole("button", { name: "Download", exact: true }),
  ).toHaveCount(0);
  expect(s.uploads()).toBe(0);
});
