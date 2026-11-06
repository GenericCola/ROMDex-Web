// QA-only preview build wrapper. NEVER promote this branch to production.
// The application sources are identical to the candidate; all OAuth is synthetic.
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const originalConfig = "{\n  \"$schema\": \"https://openapi.vercel.sh/vercel.json\",\n  \"framework\": null,\n  \"installCommand\": \"corepack pnpm install --frozen-lockfile\",\n  \"buildCommand\": \"corepack pnpm build\",\n  \"outputDirectory\": \"out\",\n  \"headers\": [\n    {\n      \"source\": \"/\",\n      \"headers\": [\n        {\n          \"key\": \"Content-Security-Policy\",\n          \"value\": \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://thegobindsingh.youtrack.cloud; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'\"\n        },\n        {\n          \"key\": \"X-Content-Type-Options\",\n          \"value\": \"nosniff\"\n        },\n        {\n          \"key\": \"X-Frame-Options\",\n          \"value\": \"DENY\"\n        },\n        {\n          \"key\": \"Referrer-Policy\",\n          \"value\": \"no-referrer\"\n        },\n        {\n          \"key\": \"Permissions-Policy\",\n          \"value\": \"camera=(), microphone=(), geolocation=()\"\n        }\n      ]\n    },\n    {\n      \"source\": \"/:path*\",\n      \"headers\": [\n        {\n          \"key\": \"Content-Security-Policy\",\n          \"value\": \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://thegobindsingh.youtrack.cloud; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'\"\n        },\n        {\n          \"key\": \"X-Content-Type-Options\",\n          \"value\": \"nosniff\"\n        },\n        {\n          \"key\": \"X-Frame-Options\",\n          \"value\": \"DENY\"\n        },\n        {\n          \"key\": \"Referrer-Policy\",\n          \"value\": \"no-referrer\"\n        },\n        {\n          \"key\": \"Permissions-Policy\",\n          \"value\": \"camera=(), microphone=(), geolocation=()\"\n        }\n      ]\n    },\n    {\n      \"source\": \"/sw.js\",\n      \"headers\": [\n        {\n          \"key\": \"Cache-Control\",\n          \"value\": \"no-cache\"\n        },\n        {\n          \"key\": \"Service-Worker-Allowed\",\n          \"value\": \"/\"\n        }\n      ]\n    },\n    {\n      \"source\": \"/api/:path*\",\n      \"headers\": [\n        {\n          \"key\": \"Cache-Control\",\n          \"value\": \"no-store\"\n        }\n      ]\n    }\n  ],\n  \"rewrites\": [\n    {\n      \"source\": \"/api/auth/start\",\n      \"destination\": \"/api\"\n    },\n    {\n      \"source\": \"/api/auth/callback\",\n      \"destination\": \"/api\"\n    },\n    {\n      \"source\": \"/api/auth/session\",\n      \"destination\": \"/api\"\n    },\n    {\n      \"source\": \"/api/auth/renew\",\n      \"destination\": \"/api\"\n    },\n    {\n      \"source\": \"/api/auth/logout\",\n      \"destination\": \"/api\"\n    },\n    {\n      \"source\": \"/api/auth/cancel\",\n      \"destination\": \"/api\"\n    },\n    {\n      \"source\": \"/api/youtrack\",\n      \"destination\": \"/api\"\n    },\n    {\n      \"source\": \"/api/attachment\",\n      \"destination\": \"/api\"\n    }\n  ],\n  \"functions\": {\n    \"api/index.ts\": {\n      \"maxDuration\": 60\n    }\n  }\n}\n";
const originalIgnore = ".git\n.agents\n.claude\n.codex\n.env*\nartifacts\ndocs\ntests\npatches\nyoutrack-app\nyoutrack-acceptance\nnode_modules\n.next\nout\ntest-results\nplaywright-report\n.playwright-browsers\n.playwright-mcp\n*.db\n*.db-*\n*.pem\n*.log\n*.tsbuildinfo\n.pnpm-store\n.vercel\nmedia\ncoverage\n\nserver/*.test.ts\nserver/*fixture.ts\n";
writeFileSync("vercel.json", originalConfig);
writeFileSync(".vercelignore", originalIgnore);
// Pass only ordinary execution paths to child processes. Do not propagate any
// account tokens, platform credentials, production keys or application secrets.
const env = { CI: "true", NEXT_TELEMETRY_DISABLED: "1" };
for (const name of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"])
  if (process.env[name]) env[name] = process.env[name];
// Nested package scripts must use the same exact Corepack-selected pnpm.
const shim = mkdtempSync(join(tmpdir(), "romdex-qa-bin-"));
writeFileSync(join(shim, "pnpm"), '#!/bin/sh\nexec corepack pnpm "$@"\n', { mode: 0o700 });
env.PATH = shim + ":" + env.PATH;
const run = (cmd, args, timeout = 600000) => {
  console.log("ROMDEX_QA_COMMAND", cmd, args.join(" "));
  const result = spawnSync(cmd, args, { env, stdio: "inherit", timeout });
  console.log("ROMDEX_QA_EXIT", result.status, result.signal ?? "");
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run("corepack", ["pnpm", "build"]);
run("corepack", ["pnpm", "check"]);
run("dnf", ["install", "-y", "nss", "atk", "at-spi2-atk", "cups-libs", "libdrm", "libXcomposite", "libXdamage", "libXext", "libXfixes", "libXrandr", "libxkbcommon", "pango", "alsa-lib", "mesa-libgbm"]);
run("node", ["scripts/playwright.mjs", "install", "chromium", "--only-shell"]);
run("node", ["scripts/playwright.mjs", "test", "--project=chromium", "tests/e2e/drag-precision.spec.ts", "tests/e2e/ui-layout.spec.ts", "tests/e2e/notes-editing.spec.ts", "tests/e2e/task-port.spec.ts", "--reporter=line"], 600000);
run("dnf", ["install", "-y", "gtk3", "dbus-glib", "libXt"]);
run("node", ["scripts/playwright.mjs", "install", "firefox"]);
run("node", ["scripts/playwright.mjs", "test", "--project=firefox", "tests/e2e/drag-precision.spec.ts", "tests/e2e/ui-layout.spec.ts", "tests/e2e/notes-editing.spec.ts", "tests/e2e/task-port.spec.ts", "--reporter=line"], 600000);
console.log("ROMDEX_DRAG_PRECISION_QA_COMPLETE");
