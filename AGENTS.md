# ROMDex Web

React and PWA foundation restarted on October 22, 2026. The application feature port still requires the user's explicit authorization after original feature completion.

Use YouTrack as the only application backend. Static hosting is allowed. No Payload, runtime GitHub data backend, proxy, Server Actions or production data changes.

Read README.md, docs/PROJECT.md, docs/PWA.md, docs/CONVENTIONS.md and docs/DESIGN.md before editing. Preserve compatible template components and tooling. Use ponytail (full), ponytail-review and human-writing in .agents/skills. Fetch current library documentation and inspect installed Next.js docs before using unfamiliar APIs.

Use named callbacks, strict TypeScript, token-based styles and accessible React controls. Keep secrets outside Git and browser-public variables. Never read or print .env files. Update documentation with behavior changes.

Run pnpm check, pnpm build and pnpm test:e2e. Do not call historical test results current verification. Keep dev on 3001 and preview on 3000. Preserve production data and the original app separately. Never resume cloud queues as a test.

The template remote has push URL DISABLED. Verify private visibility before publishing. No deployment, public release, billing changes or Actions enablement are authorized.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in`node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the`next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by`next dev` — verify at`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
