import { spawnSync } from "node:child_process";
const fix = process.argv.includes("--fix");
for (const [cli, args] of [
  [
    "prettier/bin/prettier.cjs",
    [
      "--config",
      ".prettierrc",
      "src/**/*.{ts,js,tsx,jsx}",
      fix ? "--write" : "--check",
    ],
  ],
  [
    "eslint/bin/eslint.js",
    ["src/**/*.{ts,js,tsx,jsx}", "--max-warnings=0", ...(fix ? ["--fix"] : [])],
  ],
]) {
  const result = spawnSync(process.execPath, ["node_modules/" + cli, ...args], {
    stdio: "inherit",
    env: { ...process.env, SYNCKIT_TIMEOUT: "180000" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
