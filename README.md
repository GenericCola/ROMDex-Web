# ROMDex Web

Current native result (October 24): system privileges now permit self-installation. Acceptance 1.0.12 is installed in place as app 155-84 on NPCD only. Native reads, assignment/rollup, receipts, fresh-page persistence and correlated rollback pass after the API/body-stream repairs. The child concurrency test accepted both same-revision writers, so production sharing remains blocked. See [LIVE-ACCEPTANCE-2026-10-24.md](docs/LIVE-ACCEPTANCE-2026-10-24.md) for evidence and pending work. Earlier version, permission and withheld-package paragraphs below are historical. Vercel is the selected eventual host.

React/PWA port of the accepted ROMDex desktop app, based on theGobindSingh/next-starter-template. The task workspace, reviewed desktop import, NPCDex browsing/planning drafts and local RDX library are implemented. The full application port remains in progress. See docs/DESKTOP-MIGRATION.md for migration and remaining cutover work. Read docs/PORT.md for scope and docs/SHARED-STATUS.md for the current YouTrack-backed assigned-status checkpoint and app installation instructions. Live PMON compatibility and development boundaries are in docs/PMON-DEVELOPMENT.md. Test-only installation status and administrator steps are in docs/LIVE-ACCEPTANCE.md. Structural delivery is documented in docs/STRUCTURAL-DELIVERY.md.

Requires Node.js 24.x and pnpm 11.25.0.

    pnpm install --frozen-lockfile
    pnpm check
    pnpm build
    pnpm browser:install
    pnpm test:e2e
    pnpm package:youtrack

Run pnpm dev at http://localhost:3001. Run pnpm build followed by pnpm start for the static preview at http://localhost:3000. Browser tests serve the build on port 3100; set E2E_PORT to use another port. WebKit needs system libraries that some Linux hosts lack. Service workers register only in production.

Read docs/PROJECT.md, docs/PWA.md, docs/CONVENTIONS.md and docs/DESIGN.md. The template components, styling tokens and tooling are retained where compatible. Payload and Lenis are removed. YouTrack is the only application backend. Optional session delivery supports task creation, explicit deletion lists, hierarchy, assigned choices with calculated parent State, edits and comments; opt-in shared assigned status requires the included YouTrack app. The full port remains in progress.

Vercel static hosting is configured in vercel.json. See docs/TASK-FIRST-MIGRATION.md for the installed-app cutover gates and docs/ATTACHMENTS.md for staged file delivery and recovery. Hosted-origin and actual Windows installation acceptance remain separate checks.

The YouTrack repair has completed consolidated local QA. No further administrator installation is requested; the earlier 1.0.6 acceptance handoff is withdrawn. See docs/YOUTRACK-CONSOLIDATED-QA.md for frozen-candidate evidence and native verification limits.

The task toolbar filter popup is available in the web/PWA port and installed desktop client. See docs/TASK-FILTERS.md for matching rules and verification.

Desktop Status popups retain working close controls while metadata preparation is pending. See docs/STATUS-DIALOG-REPAIR.md for the repair and verification.

The Vercel preview is live at https://romdex-web.vercel.app. All 26 hosted
Chrome/Firefox checks pass. Authenticated browser acceptance and the native shared-status race
still block daily-work cutover. The administrator has completed the exact-origin
CORS allowance, and its anonymous preflights pass. Keep the desktop for current work. Current
hosted evidence and the one-origin administrator note are linked from
[the migration checklist](docs/TASK-FIRST-MIGRATION.md).

The web UI repair restores usable task-property and note columns, save-light
spacing, centered scrollable dialogs and keyboard/pointer workspace-menu
controls. See [UI-REPAIR-2026-10-24.md](docs/UI-REPAIR-2026-10-24.md) for
current rendered verification and delivery evidence.

October 25: the owner resumed migration. UI source 3e8c0db is deployed at https://romdex-web.vercel.app and all 34 hosted Chrome/Firefox checks pass, including actual CORS refusal messages. See docs/MIGRATION-RESUME-2026-10-25.md (relative to repository root) for the active queue and evidence. Authenticated native acceptance, concurrent shared-status safety and desktop cutover remain pending.

November 7: browser acceptance of the YouTrack data store (PMON-575) passed against a fake YouTrack; no live check and no Vercel preview were possible yet. The e2e specs were brought up to date with cookie sign-in and the desktop-parity UI. See [ACCEPTANCE-YOUTRACK-STORE.md](docs/ACCEPTANCE-YOUTRACK-STORE.md) for results and the open app questions.
