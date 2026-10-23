# ROMDex Web

React/PWA port of the accepted ROMDex desktop app, based on theGobindSingh/next-starter-template. The task workspace, reviewed desktop import, NPCDex browsing/planning drafts and local RDX library are implemented. The full application port remains in progress. See docs/DESKTOP-MIGRATION.md for migration and remaining cutover work. Read docs/PORT.md for scope and docs/SHARED-STATUS.md for the current YouTrack-backed assigned-status checkpoint and app installation instructions. Live PMON compatibility and development boundaries are in docs/PMON-DEVELOPMENT.md. Test-only installation status and administrator steps are in docs/LIVE-ACCEPTANCE.md. Structural delivery is documented in docs/STRUCTURAL-DELIVERY.md.

Requires Node.js 24+ and pnpm 11.25.0.

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build
    pnpm browser:install
    pnpm test:e2e
    pnpm package:youtrack

Run pnpm dev at http://localhost:3001. Run pnpm build followed by pnpm start for the static preview at http://localhost:3000. Browser tests use port 3100. Service workers register only in production.

Read docs/PROJECT.md, docs/PWA.md, docs/CONVENTIONS.md and docs/DESIGN.md. The template components, styling tokens and tooling are retained where compatible. Payload and Lenis are removed. YouTrack is the only application backend. Optional session delivery supports task creation, explicit deletion lists, hierarchy, assigned choices with calculated parent State, edits and comments; opt-in shared assigned status requires the included YouTrack app. The full port remains in progress.

No deployment has been configured. Production hosting needs HTTPS, root-origin paths and the headers from public/_headers. Real iOS installation and HTTPS hosting require separate acceptance checks.
