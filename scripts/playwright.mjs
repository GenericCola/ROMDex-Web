import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: ".playwright-browsers" },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
