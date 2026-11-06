// Moves ROMDex-Data into the "ROMDex data" and "NPCDex data" YouTrack articles.
// See docs/YOUTRACK-STORAGE.md section 4. ROMDex-Data is only read (GET).
//
// Dry run (default): verify, rebuild and report what would be written.
//   node scripts/migrate-youtrack-storage.mjs --cache <dir> [--report <file>]
// Write to the test articles in TST:
//   node scripts/migrate-youtrack-storage.mjs --write --target test --cache <dir> --receipt <file>
// Write to production (cutover only, with the desktop app quit for good):
//   node scripts/migrate-youtrack-storage.mjs --write --target production --i-have-quit-the-desktop-app --cache <dir> --receipt <file>
//
// --write needs YOUTRACK_URL and YOUTRACK_TOKEN in the environment.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { tokenTransport } from "../src/store/core/index.ts";
import { createGitHubSource } from "./migration/github-source.mjs";
import {
  buildPlan,
  formatReport,
  reportJson,
  SOURCE,
} from "./migration/plan.mjs";
import { reportArticles, runWrite, writeTargets } from "./migration/write.mjs";

const usage = `Usage: node scripts/migrate-youtrack-storage.mjs [options]
  --dry-run                       Read, verify and report only (default)
  --write                         Create or update the articles, then verify them from YouTrack
  --target <name>                 production (default) or test (project TST)
  --test-label <label>            With --target test: a separate pair of test articles
  --i-have-quit-the-desktop-app   Required for --write --target production
  --cache <dir>                   Download cache (default $ROMDEX_MIGRATION_CACHE)
  --report <file>                 Save the text report here, and <file>.json beside it
  --receipt <file>                Required with --write: where to save the JSON receipt
Exit codes: 0 done or already migrated, 1 error, 2 usage, 3 part over 4 MB,
4 ROMDex-Data moved during the run, 5 an article holds other content (nothing written).`;

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

const outsideRepo = (path, what) => {
  const repoRoot = resolve(import.meta.dirname, "..");
  const full = resolve(path);
  if (full === repoRoot || full.startsWith(repoRoot + "/"))
    fail(`Keep the ${what} outside the repository.`, 2);
  return full;
};

const saveFile = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const main = async () => {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      write: { type: "boolean" },
      target: { type: "string", default: "production" },
      "test-label": { type: "string" },
      "i-have-quit-the-desktop-app": { type: "boolean" },
      cache: { type: "string", default: process.env.ROMDEX_MIGRATION_CACHE },
      report: { type: "string" },
      receipt: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return console.log(usage);
  if (values.write && values["dry-run"])
    return fail("Choose --dry-run or --write, not both.", 2);
  if (
    values.write &&
    values.target === "production" &&
    !values["i-have-quit-the-desktop-app"]
  )
    return fail(
      "Writing to the production articles needs --i-have-quit-the-desktop-app: the desktop app still appends to ROMDex-Data, so migrate only after it is quit for good.",
      2,
    );
  if (!values.cache) return fail(`--cache is required.\n${usage}`, 2);
  if (values.write && !values.receipt)
    return fail("--write needs --receipt <file>.", 2);
  let targets;
  try {
    targets = writeTargets({
      target: values.target,
      label: values["test-label"],
    });
  } catch (error) {
    return fail(error.message, 2);
  }
  const cacheDir = outsideRepo(values.cache, "cache");
  const receiptPath = values.receipt && outsideRepo(values.receipt, "receipt");
  let transport;
  if (values.write) {
    const { YOUTRACK_URL: url, YOUTRACK_TOKEN: token } = process.env;
    if (!url || !token)
      return fail("--write needs YOUTRACK_URL and YOUTRACK_TOKEN.", 2);
    transport = tokenTransport(url, token, 60000);
  }

  const github = createGitHubSource({
    repo: SOURCE.repo,
    branch: SOURCE.branch,
    token: githubToken(),
    cacheDir,
  });
  const log = (line) => console.error(line);
  const plan = await buildPlan({
    source: github,
    target: values.target,
    articles: reportArticles(targets),
    log,
  });
  const text = formatReport(plan, { write: values.write });
  console.log(text);
  if (values.report) {
    const path = resolve(values.report);
    saveFile(path, text);
    saveFile(`${path}.json`, reportJson(plan));
    console.error(`Report saved to ${path} and ${path}.json`);
  }
  if (plan.metadata.oversized.length || plan.npcdex.oversized.length) {
    process.exitCode = 3;
    return;
  }
  if (!values.write) return;

  const me = await transport.request(
    "users/me?fields=id",
    "GET",
    undefined,
    true,
  );
  if (typeof me?.id !== "string")
    return fail("YouTrack did not say who is signed in.");
  const receipt = await runWrite({
    plan,
    transport,
    github,
    targets,
    writtenBy: me.id,
    log,
  });
  saveFile(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  console.error(`Receipt saved to ${receiptPath}`);
  for (const [store, entry] of Object.entries(receipt.stores))
    console.log(
      `${store}: ${entry.result}${entry.article ? ` (${entry.article.idReadable})` : ""}${entry.reason ? ` - ${entry.reason}` : ""}`,
    );
  console.log(`Result: ${receipt.result}`);
  if (receipt.result === "stopped") process.exitCode = 5;
};

main().catch((error) =>
  fail(
    `Migration stopped: ${error.message}`,
    error.code === "HEAD_MOVED" ? 4 : 1,
  ),
);
