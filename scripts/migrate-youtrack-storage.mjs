// Moves ROMDex-Data into the "ROMDex data" and "NPCDex data" YouTrack articles.
// See docs/YOUTRACK-STORAGE.md section 4. Only the dry run exists so far: it
// reads ROMDex-Data with GET requests, verifies and rebuilds everything, and
// reports what would be written. It writes nothing anywhere except the report
// files you name and its download cache.
//
//   node scripts/migrate-youtrack-storage.mjs --cache <dir> [--report <file>] [--target test]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createGitHubSource } from "./migration/github-source.mjs";
import {
  buildPlan,
  formatReport,
  reportJson,
  SOURCE,
} from "./migration/plan.mjs";

const usage = `Usage: node scripts/migrate-youtrack-storage.mjs [options]
  --dry-run          Read, verify and report only (default and only mode for now)
  --write            Not available yet
  --target <name>    production (default) or test
  --cache <dir>      Download cache (default $ROMDEX_MIGRATION_CACHE)
  --report <file>    Also save the text report here, and <file>.json beside it`;

const fail = (message, code = 1) => {
  console.error(message);
  process.exit(code);
};

const githubToken = () => {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fail(
      "No GitHub token: set GITHUB_TOKEN or sign in with `gh auth login`.",
    );
  }
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      write: { type: "boolean" },
      target: { type: "string", default: "production" },
      cache: { type: "string", default: process.env.ROMDEX_MIGRATION_CACHE },
      report: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return console.log(usage);
  if (values.write)
    return fail("--write is not available yet; run the dry run.", 2);
  if (!values.cache) return fail(`--cache is required.\n${usage}`, 2);
  const repoRoot = resolve(import.meta.dirname, "..");
  const cacheDir = resolve(values.cache);
  if (cacheDir === repoRoot || cacheDir.startsWith(repoRoot + "/")) {
    return fail("Keep the cache outside the repository.", 2);
  }

  const source = createGitHubSource({
    repo: SOURCE.repo,
    branch: SOURCE.branch,
    token: githubToken(),
    cacheDir,
  });
  const plan = await buildPlan({
    source,
    target: values.target,
    log: (line) => console.error(line),
  });
  const text = formatReport(plan);
  console.log(text);
  if (values.report) {
    const path = resolve(values.report);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    writeFileSync(`${path}.json`, reportJson(plan));
    console.error(`Report saved to ${path} and ${path}.json`);
  }
  if (plan.metadata.oversized.length || plan.npcdex.oversized.length)
    process.exitCode = 3;
};

main().catch((error) =>
  fail(
    `Migration stopped: ${error.message}`,
    error.code === "HEAD_MOVED" ? 4 : 1,
  ),
);
