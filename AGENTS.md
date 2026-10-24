# ROMDex Web

October 24 native acceptance gate: GenericCola now has verified app-update access. Acceptance 1.0.12 is installed as app 155-84, Active on NPCD only. API access, request-stream parsing, receipts, persistence and correlated rollback are verified, but the child race accepted two same-revision writers. Keep production sharing OFF and production source 1.0.8 withheld until supported atomic concurrency is implemented and natively retested. Preserve both synthetic fixtures and their receipts, all PMON tasks and the desktop app/data. See [docs/LIVE-ACCEPTANCE-2026-10-24.md](docs/LIVE-ACCEPTANCE-2026-10-24.md). The owner selected Vercel hosting and confirmed the existing Vercel account is signed in. Static hosting is live at https://romdex-web.vercel.app, with 26 hosted Chrome/Firefox checks passing. The approved Vercel integration is restricted to GenericCola/ROMDex-Web and tracks codex/accepted-app-port. Daily cutover remains blocked by YouTrack CORS and shared-status concurrency. See docs/TASK-FIRST-MIGRATION.md and docs/CORS-ORIGIN-HANDOFF.md.

React and PWA foundation restarted on October 22, 2026. On October 22, 2026 the user supplied PASSKEY and authorized porting the current accepted desktop app first, then finishing remaining features on web. Keep the desktop app and its data intact as the fallback.

On October 22, 2026 the user authorized test-only YouTrack app installation and live acceptance testing, then selected existing NPCD because no disposable project is available. Restrict mutations to the new private fixtures NPCD-872 and NPCD-873. Preserve all existing NPCD issues and settings; production PMON sharing remains off. See docs/LIVE-ACCEPTANCE.md for the administrator activation blocker.

On October 22, 2026 the owner authorized continuing web development against live PMON, the current ROMDex task project. Live reads and PMON compatibility work are allowed. Keep developer acceptance mutations confined to the existing NPCD fixture allowlist; do not use existing PMON tasks or live queues as tests. User-triggered web delivery remains explicit and session-scoped. Preserve the installed desktop app, saved data and credentials.

Use YouTrack as the only application backend. Static hosting is allowed. No Payload, runtime GitHub data backend, proxy, Server Actions or production data changes.

Read README.md, docs/PROJECT.md, docs/PWA.md, docs/CONVENTIONS.md and docs/DESIGN.md before editing. Preserve compatible template components and tooling. Use ponytail (full), ponytail-review and human-writing in .agents/skills. Fetch current library documentation and inspect installed Next.js docs before using unfamiliar APIs.

Use named callbacks, strict TypeScript, token-based styles and accessible React controls. Keep secrets outside Git and browser-public variables. Never read or print .env files. Update documentation with behavior changes.

Run pnpm check, pnpm build and pnpm test:e2e. Do not call historical test results current verification. Keep dev on 3001 and preview on 3000. Preserve production data and the original app separately. Never resume cloud queues as a test.

The template remote has push URL DISABLED. Verify private visibility before publishing. The owner subsequently authorized Vercel hosting for the installed web app. Deploy only the reviewed static shell, with no desktop data or credentials. Billing changes and Actions enablement remain unauthorized.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in`node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the`next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by`next dev` — verify at`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
