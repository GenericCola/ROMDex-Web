// Usage: node measure.mjs <label> <checkoutPath> [port] [cpuRate]
//   checkoutPath = a worktree with out/, scripts/serve.mjs, public/_headers, node_modules (default cwd).
//   Results go to result-<label>.json in PERF_OUT (default: tests/perf/results).
// Serves out/ on the given 32xx port, drives Chromium through a fixed scenario
// list against a synthetic 490-task PMON fixture, and records CDP metrics,
// long tasks, Event Timing and IndexedDB put timings per scenario.
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
const WT = path.resolve(process.argv[3] ?? process.cwd());
process.chdir(WT); // serve.mjs resolves out/ and public/_headers against cwd
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(WT, ".playwright-browsers");
const { chromium } = await import(pathToFileURL(path.join(WT, "node_modules/@playwright/test/index.mjs")).href);
const { createPreview } = await import(pathToFileURL(path.join(WT, "scripts/serve.mjs")).href);
const { buildTasks, rawIssue, fieldList } = await import("./fixture.mjs");
const label = process.argv[2] ?? "run";
const port = Number(process.argv[4] ?? 3900);
const cpu = Number(process.argv[5] ?? 1);
const APP = "https://romdex.vercel.app";
const tasks = buildTasks();
const byId = new Map(tasks.map((t) => [t.id, t]));
const unknown = new Set();
let reqs = {};
const server = await createPreview(port);
const browser = await chromium.launch();
const results = { label, cpu, tasks: tasks.length, scenarios: {} };
try {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: "__Host-romdex-generation", value: "f".repeat(43), url: APP + "/", secure: true, sameSite: "Lax" }]);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== APP) return route.abort();
    if (url.pathname === "/api/auth/session")
      return route.fulfill({ json: { userId: "fixture-owner", projects: [{ id: "0-1", shortName: "PMON", name: "Synthetic PMON" }], csrf: "synthetic-csrf", expiresAt: Math.floor(Date.now() / 1000) + 3600 } });
    if (url.pathname === "/api/youtrack") {
      const key = (url.searchParams.get("route") ?? "").split("?")[0].replace(/PMON-\d+/, "PMON-n");
      reqs[key] = (reqs[key] ?? 0) + 1;
      const method = route.request().method();
      if (method !== "GET") { unknown.add(method + " " + key); return route.fulfill({ status: 500, json: {} }); }
      const inner = new URL("https://x/api/" + url.searchParams.get("route"));
      const p = inner.pathname;
      if (p === "/api/users/me") return route.fulfill({ json: { id: "fixture-owner", login: "owner", name: "Owner" } });
      if (p === "/api/admin/projects") return route.fulfill({ json: [{ id: "0-1", shortName: "PMON", name: "Synthetic PMON" }] });
      if (p === "/api/admin/projects/0-1/customFields")
        return route.fulfill({ json: fieldList.map((name, i) => ({ id: "92-" + i, field: { name, fieldType: { id: name === "State" ? "state[1]" : "enum[1]" } } })) });
      if (p === "/api/issues") {
        const skip = Number(inner.searchParams.get("$skip") ?? 0), top = Number(inner.searchParams.get("$top") ?? 100);
        return route.fulfill({ json: tasks.slice(skip, skip + top).map(rawIssue) });
      }
      const parts = p.split("/");
      const task = byId.get(parts[3] ?? "");
      if (task && parts.length === 4) return route.fulfill({ json: rawIssue(task) });
      if (task && ["comments", "attachments", "links"].includes(parts[4] ?? "")) return route.fulfill({ json: [] });
      unknown.add("GET " + key);
      return route.fulfill({ json: [] });
    }
    if (url.pathname.startsWith("/api/")) { unknown.add(url.pathname); return route.fulfill({ status: 404, body: "" }); }
    const response = await route.fetch({ url: "http://127.0.0.1:" + port + url.pathname + url.search });
    return route.fulfill({ response });
  });
  await context.addInitScript(() => {
    const perf = (window.__perf = { long: [], events: [], idb: [] });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) perf.long.push({ start: e.startTime, duration: e.duration }); }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) perf.events.push({ name: e.name, duration: e.duration }); }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const t0 = performance.now(), tx = this.transaction;
      const r = put.apply(this, args);
      const s0 = performance.now();
      tx.addEventListener("complete", () => perf.idb.push({ sync: s0 - t0, total: performance.now() - t0 }));
      return r;
    };
  });
  const page = await context.newPage();
  page.setDefaultTimeout(180000);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
  const quiet = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 400)))));
  const measure = async (name, action, settle, extra) => {
    await page.evaluate(() => { const p = window.__perf; if (p) { p.long = []; p.events = []; p.idb = []; } }).catch(() => {});
    const m0 = await metrics().catch(() => ({}));
    const t0 = Date.now();
    await action();
    if (settle) await settle();
    const wall = Date.now() - t0;
    await quiet();
    const m1 = await metrics();
    const p = await page.evaluate(() => window.__perf);
    const reloaded = (m1.TaskDuration ?? 0) < (m0.TaskDuration ?? 0) || name.includes("open") || name.includes("reload");
    const d = (k) => +(((m1[k] ?? 0) - (reloaded ? 0 : (m0[k] ?? 0))) * 1000).toFixed(0);
    const long = p.long.map((x) => x.duration);
    const ev = p.events.filter((e) => ["keydown", "keyup", "keypress", "pointerdown", "pointerup", "click", "input", "beforeinput"].includes(e.name));
    const r = {
      wallMs: wall,
      taskMs: d("TaskDuration"), scriptMs: d("ScriptDuration"), layoutMs: d("LayoutDuration"), styleMs: d("RecalcStyleDuration"),
      longTasks: long.length, longTotalMs: Math.round(long.reduce((a, b) => a + b, 0)), longMaxMs: Math.round(Math.max(0, ...long)),
      maxEventMs: Math.round(Math.max(0, ...ev.map((e) => e.duration))),
      idbPuts: p.idb.length, idbMaxMs: Math.round(Math.max(0, ...p.idb.map((x) => x.total))),
      domNodes: m1.Nodes, requests: reqs,
      ...(extra ? await extra() : {}),
    };
    reqs = {};
    results.scenarios[name] = r;
    console.log(name.padEnd(24), JSON.stringify(r));
  };
  const rowsReady = () => page.waitForFunction(() => /\d+ Visible \/ 490 in View/.test(document.querySelector(".work-footer span")?.textContent ?? ""), null, { timeout: 120000 });
  const footer = (re) => () => page.waitForFunction((src) => new RegExp(src).test(document.querySelector(".work-footer span")?.textContent ?? ""), re.source);
  await measure("cold-open", async () => { await page.goto(APP + "/"); }, rowsReady);
  const auto = page.getByRole("switch", { name: "Auto-Sync Data", exact: true });
  if ((await auto.getAttribute("aria-checked").catch(() => null)) === "true") await auto.click();
  await quiet();
  reqs = {};
  await measure("idle-20s", () => page.waitForTimeout(20000));
  await measure("warm-reload", async () => { await page.reload(); }, rowsReady);
  await quiet();
  await measure("expand-all", () => page.getByRole("button", { name: "Expand All", exact: true }).click(), footer(/^490 Visible/));
  // scroll-expanded: wheel the fully expanded table top to bottom, recording rAF gaps.
  await page.locator(".table-scroll").evaluate((el) => { el.scrollTop = 0; });
  await quiet();
  await page.mouse.move(720, 500);
  await measure("scroll-expanded", async () => {
    await page.evaluate(() => {
      const f = (window.__frames = { t: [], on: true });
      const tick = (now) => { if (f.on) { f.t.push(now); requestAnimationFrame(tick); } };
      requestAnimationFrame(tick);
    });
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 600);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    await page.evaluate(() => { window.__frames.on = false; });
  }, undefined, async () => {
    const gaps = await page.evaluate(() => window.__frames.t.slice(1).map((x, i) => x - window.__frames.t[i]));
    return { frames: gaps.length + 1, framesOver50: gaps.filter((g) => g > 50).length, worstFrameMs: Math.round(Math.max(0, ...gaps)) };
  });
  // Bring a row on screen outside the measured action. Windowed builds render only rows near the
  // viewport, so step the table down until the row exists; on other builds it exists at once.
  const reveal = async (id) => {
    await page.locator(".table-scroll").evaluate(async (el, rowId) => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
      el.scrollTop = 0;
      await frame();
      while (!document.querySelector(`tr[data-row="${rowId}"]`) && el.scrollTop + el.clientHeight < el.scrollHeight) {
        el.scrollTop += el.clientHeight / 2;
        await frame();
      }
    }, id);
    await page.locator(`tr[data-row="${id}"]`).scrollIntoViewIfNeeded();
    await quiet();
  };
  await reveal("PMON-200");
  await measure("select-row", () => page.locator('tr[data-row="PMON-200"] button.row-title').click(), () => page.waitForFunction(() => document.querySelector('tr[data-row="PMON-200"]')?.classList.contains("selected")));
  await reveal("PMON-2");
  await measure("toggle-one-row", () => page.locator('tr[data-row="PMON-2"] .row-toggle').first().click(), () => page.waitForFunction(() => !/^490 Visible/.test(document.querySelector(".work-footer span")?.textContent ?? "")));
  const notes = page.getByRole("textbox", { name: "Notes and Instructions", exact: true });
  await notes.click();
  await measure("type-notes-30", () => notes.pressSequentially("typing some synthetic notes..", { delay: 30 }));
  const search = page.getByLabel("Search This View", { exact: true });
  await search.click();
  await measure("type-search-10", () => search.pressSequentially("battle map", { delay: 50 }));
  await measure("clear-search", () => search.fill(""));
  await measure("collapse-all", () => page.getByRole("button", { name: "Collapse All", exact: true }).click(), footer(/^10 Visible/));
  await notes.click();
  await measure("type-notes-collapsed-30", () => notes.pressSequentially(" more synthetic notes typed..", { delay: 30 }));
  await measure("idle-expanded-20s", () => page.waitForTimeout(20000));
  await measure("to-npcdex", async () => { await page.getByRole("button", { name: "Switch Workspace", exact: true }).click(); await page.getByRole("menuitemradio", { name: "NPCDex", exact: true }).click(); await page.waitForFunction(() => !document.querySelector(".work-footer")); });
  await measure("to-romdex", async () => { await page.getByRole("button", { name: "Switch Workspace", exact: true }).click(); await page.getByRole("menuitemradio", { name: "ROMDex", exact: true }).click(); }, rowsReady);
  results.unknownRoutes = [...unknown];
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
const outDir = path.resolve(process.env.PERF_OUT ?? path.join(import.meta.dirname, "results"));
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "result-" + label + ".json"), JSON.stringify(results, null, 2));
console.log("unknown routes:", results.unknownRoutes);
