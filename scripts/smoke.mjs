import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createPreview } from "./serve.mjs";
process.env.PLAYWRIGHT_BROWSERS_PATH = ".playwright-browsers";
const { chromium } = await import("@playwright/test");
const dev = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", "3000"],
  { stdio: "ignore", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } },
);
let preview;
let browser;
try {
  let response;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      response = await fetch("http://localhost:3000");
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(response?.status, 200, "development response");
  console.log("Development smoke: HTTP 200 on port 3000");
  preview = await createPreview(3001);
  assert.equal((await fetch("http://127.0.0.1:3001")).status, 200);
  console.log("Production preview smoke: HTTP 200 on port 3001");
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1100, height: 900 },
  });
  await page.goto("http://127.0.0.1:3001/foundation/");
  await page.getByLabel("Preview text").fill("React preview");
  await page.screenshot({
    path: "test-results/foundation-preview.png",
    fullPage: true,
  });
} finally {
  await browser?.close();
  if (preview) {
    preview.closeAllConnections();
    await new Promise((resolve) => preview.close(resolve));
  }
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(dev.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  else dev.kill();
}
