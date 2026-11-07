import { defineConfig, devices } from "@playwright/test";
import { LOCAL_ORIGIN } from "./tests/e2e/local-origin";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.mjs",
  use: { baseURL: LOCAL_ORIGIN, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
