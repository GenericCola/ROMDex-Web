# Live PMON development

The owner authorized continuing web development against live PMON on October 22, 2026. PMON is the current ROMDex task project. The web reader and delivery adapter already target PMON; NPCD is the separate restricted app-acceptance environment.

## Current compatibility

Live MCP reads confirmed the State bundle includes Needs Testing and excludes Awaiting Testing. ROMDex keeps Awaiting Testing as its display and assigned-choice label. Native status payloads, creation verification, leaf calculations and parent rollups use Needs Testing. Both names display amber. Reading an existing Needs Testing task does not queue a conversion or change its stored assignment.

Any testing child makes its parent display amber, regardless of other sibling statuses. This propagates through higher ancestors. Once no child awaits testing, the previous precedence applies. Parent assigned choices remain separate from their calculated State. Standby is inherited only when at least two immediate children are all effectively Standby. Exactly one Standby child and mixed Done/Standby children produce In Progress. A leaf retains its own assignment. Recursive calculations use each immediate child's effective status.

PMON uses Minor, Normal, Major, Critical and Show-stopper priorities. The picker now offers these values. Existing native values outside the standard status or priority choices remain visible and are preserved until the user changes them. Older queued unsupported priorities require normal delivery review; the app does not silently rewrite them.

The packaged YouTrack app is source version 1.0.6 and advertises statusRules 4. The browser refuses shared-status delivery through an older app, even if its metadata schema is otherwise compatible. The app maps an Awaiting Testing assignment to the existing native State for validation, stores the exact assignment and receipt, and writes only the calculated native State. It never creates a field or State value.

## Development boundaries

Use live PMON reads to inspect schema and task relationships. Do not use existing PMON tasks or pending queues as developer acceptance tests. Keep all mutation, uncertainty, recovery and concurrency tests synthetic or within the existing explicitly scoped NPCD fixtures. The test archive remains restricted to NPCD-872 and NPCD-873.

The Connection Details reader previews live tasks and saves a browser copy only after the user chooses it. It performs no cloud writes. Tokens stay in dialog memory. Delivery requires a separate session token and explicit enablement; enabling shared assigned status requires its preview and confirmation too. No saved desktop credentials are copied into the web app.

Live task reads reflect native effective State. They do not import the desktop's separately saved parent assigned choices, maps or other local metadata. The desktop application and Data remain the fallback. Review shared-status migration before treating a fresh web device as the full desktop workspace.

No PMON issue, field, workflow, app attachment or permission was changed during this compatibility work. The installed desktop app and its data were not modified. No hosting deployment or automatic replay of live changes was performed.

## Acceptance

Read-only live evidence: PMON's field schema and native Needs Testing tasks with parent relationships were read through the YouTrack MCP. No production content was copied into test fixtures or public assets.

Local regression checks cover both testing names, mixed sibling precedence through multiple ancestors, native payloads, creation readback, stable leaf calculations, preserved parent assignments and older-app rejection. Browser tests cover native task reads, the displayed status and priority, parent delivery, repeat-save stability and reload persistence with intercepted synthetic responses.

Shared cross-device status still needs administrator installation and activation of the compatible app, plus live transaction and real-origin CORS acceptance. The inactive NPCD acceptance harness is not a PMON production installation. No live shared-status success is claimed.

## Verified checkpoint

Verified October 22, 2026: pnpm check passed type checking, formatting, zero-warning lint, 93 unit tests and eight worker/build checks. pnpm build passed with 69 public shell assets. The complete browser suite passed 128 tests across Chromium, Firefox, WebKit, Android and iPhone emulation, with two expected mobile skips for desktop geometry. Package tests verified the production and restricted acceptance archives; an independent Python ZIP reader verified the production archive's CRCs, six-file boundary, manifest version and SHA-256.

What this change does: Aligns testing status and priority selection with the live PMON schema while retaining the ROMDex label and the owner's any-child rollup rule. The shared app requires a matching rule version and preserves revision checks, exact receipts and read-only GET behavior.

Looks good for this implementation checkpoint. Reviewed the request builders, creation verification, browser status journal, ancestor calculations, app handler, compatibility probe, UI values, archive boundaries and existing recovery paths for one personal workspace. Desktop files, live task mutations, production app activation, real-origin CORS and physical-device acceptance were outside these checks.
