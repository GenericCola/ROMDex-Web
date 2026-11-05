import type { TaskItem, WorkspaceData } from "@/domain/types";
import { expect, test, type Page } from "@playwright/test";
import { APP, routeYouTrack } from "./cookie-fixture";
import { durableCookieFixture } from "./durable-cookie-fixture";

test.use({ serviceWorkers: "block" });
const key = JSON.stringify([
  "youtrack",
  "https://thegobindsingh.youtrack.cloud",
  "fixture-owner",
  "0-1",
]);
const item = (id: string): TaskItem => ({
  id,
  summary: "Synthetic " + id,
  description: "Before",
  parentId: null,
  state: "To do",
  priority: "Normal",
  complexity: null,
  type: "Task",
  updated: 1,
  comments: [],
  commentCount: 0,
});
const readWorkspace = (page: Page) =>
  page.evaluate(async (key) => {
    return new Promise<WorkspaceData>((resolve, reject) => {
      const open = indexedDB.open("romdex-web-workspace", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result,
          tx = db.transaction("workspace"),
          read = tx.objectStore("workspace").get(key);
        tx.oncomplete = () => {
          db.close();
          resolve(read.result.data);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }, key);

for (const status of ["attempting", "uncertain"] as const)
  for (const autoSync of [false, true])
    test(`real-cookie renewal preserves ${status} work; existing autosync=${autoSync}`, async ({
      page,
    }) => {
      await page.clock.install();
      const f = await durableCookieFixture(page);
      await f.login();
      const held = item("PMON-900001"),
        ready = item("PMON-900002");
      const data: WorkspaceData = {
        schemaVersion: 1,
        newTask: null,
        titleDrafts: {},
        remote: [held, ready],
        operations: [
          {
            opId: "held-comment",
            type: "comment",
            issueId: held.id,
            text: "Keep until reviewed",
            created: 1,
          },
          {
            opId: "ready-edit",
            type: "edit",
            issueId: ready.id,
            base: ready,
            patch: { description: "Ready independent work" },
          },
        ],
        cloud: {
          accountId: "fixture-owner",
          autoSync,
          records: {
            "held-comment": {
              status,
              targetId: held.id,
              message: "Synthetic interrupted delivery",
            },
            "ready-edit": { status: "ready", message: "Ready" },
          },
        },
        order: {},
        commentDrafts: {},
        view: {
          workspace: "romdex",
          scope: null,
          selected: null,
          search: "",
          hideCompleted: false,
          expanded: [],
          selectorExpanded: [],
          detailsMode: "default",
          workHeight: 46,
        },
      };
      // Crash-recovery state is seeded durably before the application opens. The
      // application then restores it through its real IndexedDB persistence path.
      await page.evaluate(
        async ({ key, serialized }) => {
          const data = JSON.parse(serialized);
          await new Promise<void>((resolve, reject) => {
            const open = indexedDB.open("romdex-web-workspace", 1);
            open.onupgradeneeded = () =>
              open.result.createObjectStore("workspace");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result,
                tx = db.transaction("workspace", "readwrite");
              tx.objectStore("workspace").put({ revision: 1, data }, key);
              tx.oncomplete = () => {
                db.close();
                resolve();
              };
              tx.onerror = () => {
                db.close();
                reject(tx.error);
              };
            };
          });
        },
        { key, serialized: JSON.stringify(data) },
      );
      const raw = [held, ready].map((task) => ({
        id: task.id,
        idReadable: task.id,
        summary: task.summary,
        description: task.description,
        updated: 1,
        project: { id: "0-1", shortName: "PMON" },
        parent: { issues: [] },
        customFields: [],
        comments: [],
        commentsCount: 0,
      }));
      const writes: string[] = [];
      await routeYouTrack(
        page,
        "https://thegobindsingh.youtrack.cloud/api/**",
        async (route) => {
          const request = route.request(),
            path = new URL(request.url()).pathname;
          const reply = (body: unknown) => route.fulfill({ json: body });
          if (request.method() === "POST") {
            writes.push(path);
            expect(path).toBe("/api/issues/PMON-900002");
            Object.assign(raw[1]!, request.postDataJSON());
            raw[1]!.updated++;
            return reply({});
          }
          expect(request.method()).toBe("GET");
          if (path === "/api/users/me") return reply({ id: "fixture-owner" });
          if (path === "/api/admin/projects")
            return reply([{ id: "0-1", shortName: "PMON" }]);
          if (path === "/api/admin/projects/0-1/customFields") return reply([]);
          if (path === "/api/issues") return reply(raw);
          if (path.endsWith("/comments") || path.endsWith("/attachments"))
            return reply([]);
          const task = raw.find((task) => path === "/api/issues/" + task.id);
          if (task) return reply(task);
          throw Error("Unexpected synthetic request " + path);
        },
      );
      let renewals = 0;
      const refresh = f.deps.oauth.refresh!;
      let releaseRenewal!: () => void;
      const renewalGate = new Promise<void>((resolve) => {
        releaseRenewal = resolve;
      });
      f.deps.oauth.refresh = async (token) => {
        renewals++;
        await renewalGate;
        return refresh(token);
      };
      f.advance(600);
      await page.goto(APP);
      await expect.poll(() => renewals).toBe(1);
      await page.clock.fastForward(11000);
      expect(writes).toEqual([]);
      expect((await readWorkspace(page)).operations).toEqual(data.operations);
      releaseRenewal();
      await expect(
        page.getByRole("button", {
          name: "Change project: Synthetic PMON (PMON)",
        }),
      ).toBeVisible();
      await expect.poll(() => renewals).toBe(1);
      const automatic = page.getByRole("switch", {
        name: "Auto-Sync Data",
        exact: true,
      });
      await expect(automatic).toHaveAttribute("aria-checked", String(autoSync));
      await page.clock.fastForward(11000);
      if (autoSync)
        await expect.poll(() => writes).toEqual(["/api/issues/PMON-900002"]);
      else expect(writes).toEqual([]);
      await page.clock.fastForward(60000);
      const stored = await readWorkspace(page);
      expect(stored.cloud?.autoSync).toBe(autoSync);
      expect(stored.cloud?.records["held-comment"]).toMatchObject({
        status,
        targetId: held.id,
      });
      expect(stored.operations).toContainEqual(data.operations[0]);
      expect(
        stored.operations.some((operation) => operation.opId === "ready-edit"),
      ).toBe(!autoSync);
      expect(writes).toEqual(autoSync ? ["/api/issues/PMON-900002"] : []);
      await page.reload();
      await expect(automatic).toHaveAttribute("aria-checked", String(autoSync));
      await page.clock.fastForward(60000);
      expect(writes).toEqual(autoSync ? ["/api/issues/PMON-900002"] : []);
      expect(renewals).toBe(1);
      expect((await readWorkspace(page)).operations).toContainEqual(
        data.operations[0],
      );
    });
