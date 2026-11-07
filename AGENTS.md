# Quarantined PMON test authorization — October 25, 2026

The owner explicitly permits creating synthetic disposable tasks in PMON under a
quarantined Test-only Epic. Main Agent created private Epic PMON-466 and private
children PMON-467 (Chrome attachments) and PMON-468 (Firefox attachments), visible
to GenericCola. This supersedes the older NPCD-only mutation restriction only for
these new quarantined test fixtures and subsequently explicitly identified test
descendants. Existing production tasks, desktop/data and production sharing stay
protected. Current attachment browser guard permits only the selected child's
one synthetic upload and reviewed exact new-file deletion; no status/hierarchy
writes. Read docs/NATIVE-ATTACHMENT-PLAN-2026-10-25.md for the active amendment.
The earlier NPCD alias harness was never run and is superseded. Native PMON
attachment testing uses actual identities/responses and the unchanged hosted app.

# Resumed on October 25, 2026

The owner resumed migration under the updated subagent/token-efficiency guidelines.
Use sequential, bounded Build-Audit Agent, Test-QA Agent and Repair Agent assignments
only where needed; Main Agent owns the complete checklist. Prefer proven lower-cost
model/effort pairs, narrow file-backed context and reuse of exact-candidate evidence.
Record model selection, uncertainty, retries and actual outcomes. Work on one issue
at a time; preserve all acceptance gates. Read docs/MIGRATION-RESUME-2026-10-25.md.
The historical model-switch pause below is superseded by this direct resume.

# Paused at owner request — October 24, 2026

Migration is paused for a model switch. Local UI repairs pass all checks/build
and the final complete browser run (303 passed, two expected skips). They are
backed up through the private annotated tag `romdex-web-ui-pause-2026-10-24` but
are not deployed. Read docs/PAUSED-MODEL-SWITCH-2026-10-24.md before resuming.
The administrator's exact-origin CORS preflights now pass; authenticated browser
acceptance and shared-status concurrency remain open. Preserve the hosted shell,
desktop/data and all live projects until the owner resumes.

# ROMDex Web

October 24 native acceptance gate: GenericCola now has verified app-update access. Acceptance 1.0.12 is installed as app 155-84, Active on NPCD only. API access, request-stream parsing, receipts, persistence and correlated rollback are verified, but the child race accepted two same-revision writers. Keep production sharing OFF and production source 1.0.8 withheld until supported atomic concurrency is implemented and natively retested. Preserve both synthetic fixtures and their receipts, all PMON tasks and the desktop app/data. See [docs/LIVE-ACCEPTANCE-2026-10-24.md](docs/LIVE-ACCEPTANCE-2026-10-24.md). The owner selected Vercel hosting and confirmed the existing Vercel account is signed in. Static hosting is live at https://romdex-web.vercel.app, with 26 hosted Chrome/Firefox checks passing. The approved Vercel integration is restricted to GenericCola/ROMDex-Web and tracks codex/accepted-app-port. The administrator has completed the Vercel CORS allowance and exact-origin anonymous preflights pass. Daily cutover still requires authenticated browser/native attachment acceptance and safe shared-status concurrency. See docs/TASK-FIRST-MIGRATION.md and docs/CORS-ORIGIN-HANDOFF.md.

React and PWA foundation restarted on October 22, 2026. On October 22, 2026 the user supplied PASSKEY and authorized porting the current accepted desktop app first, then finishing remaining features on web. Keep the desktop app and its data intact as the fallback.

On October 22, 2026 the user authorized test-only YouTrack app installation and live acceptance testing, then selected existing NPCD because no disposable project is available. Restrict mutations to the new private fixtures NPCD-872 and NPCD-873. Preserve all existing NPCD issues and settings; production PMON sharing remains off. See docs/LIVE-ACCEPTANCE.md for the administrator activation blocker.

On October 22, 2026 the owner authorized continuing web development against live PMON, the current ROMDex task project. Live reads and PMON compatibility work are allowed. Keep developer acceptance mutations confined to the existing NPCD fixture allowlist; do not use existing PMON tasks or live queues as tests. User-triggered web delivery remains explicit and session-scoped. Preserve the installed desktop app, saved data and credentials.

Use YouTrack as the only application backend. Static hosting is allowed. No Payload, runtime GitHub data backend, proxy, Server Actions or production data changes.

Read README.md, docs/PROJECT.md, docs/PWA.md, docs/CONVENTIONS.md and docs/DESIGN.md before editing. Preserve compatible template components and tooling. Use ponytail (full), ponytail-review and human-writing in .agents/skills. Fetch current library documentation and inspect installed Next.js docs before using unfamiliar APIs.

Use named callbacks, strict TypeScript, token-based styles and accessible React controls. Keep secrets outside Git and browser-public variables. Never read or print .env files. Update documentation with behavior changes.

Run pnpm check and pnpm build locally. Browser tests (pnpm test:e2e) run in GitHub Actions (.github/workflows/ci.yml), not on the VPS, Chromium-based projects only (owner, 2026-11-07). Never merge into main unless the pull request's CI run (check and both e2e jobs) has passed on its latest commit; verify with `gh pr checks <number>` right before merging. Do not call historical test results current verification. Keep dev on 3000 and preview on 3001. Preserve production data and the original app separately. Never resume cloud queues as a test.

The template remote has push URL DISABLED. Verify private visibility before publishing. The owner subsequently authorized Vercel hosting for the installed web app. Deploy only the reviewed static shell, with no desktop data or credentials. The owner authorized GitHub Actions for checks and browser tests on 2026-11-07. Billing changes remain unauthorized.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
