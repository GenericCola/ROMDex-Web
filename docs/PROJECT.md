# ROMDex Web project

Current native result (October 24): system privileges now permit self-installation. Acceptance 1.0.12 is installed in place as app 155-84 on NPCD only. Native reads, assignment/rollup, receipts, fresh-page persistence and correlated rollback pass after the API/body-stream repairs. The child concurrency test accepted both same-revision writers, so production sharing remains blocked. See [LIVE-ACCEPTANCE-2026-10-24.md](LIVE-ACCEPTANCE-2026-10-24.md) for evidence and pending work. Earlier version, permission and withheld-package paragraphs below are historical. Vercel is the selected eventual host.

The user authorized a fresh foundation on October 22, 2026, then supplied PASSKEY to port the current accepted ROMDex app before finishing remaining features. The desktop app and its data remain the fallback. Source baseline and delivery checklist are in PORT.md.

The current web app has an initial React task workspace with durable browser tasks and drafts, recovery export, explicit read-only YouTrack loading, and optional session delivery for task creation, explicit deletion lists, hierarchy, assigned status with parent rollups, edits and comments. Assigned choices can use the included YouTrack app for cross-device storage after explicit preview and enablement. Its revision-checked writes retain recovery evidence and share effective State separately. Browser-only status mode remains available for existing workspaces. A separate test app is active in NPCD at 1.0.5. Both fixture widgets load, but live metadata GET returns HTTP 500. The earlier acceptance 1.0.6 handoff is withdrawn. Consolidated local QA covers acceptance 1.0.7 and production source 1.0.6, including shared utility exports, valid manifests, complete widget flows and explicit rollback limits. No administrator installation is requested. Native runtime acceptance remains pending. See YOUTRACK-CONSOLIDATED-QA.md. Only new private fixtures NPCD-872 and NPCD-873 are authorized for mutation. Production sharing remains off. Live PMON reads and compatibility development are now authorized; see PMON-DEVELOPMENT.md for the current status mapping and checks. Existing PMON tasks are not developer test fixtures. See LIVE-ACCEPTANCE.md. See SHARED-STATUS.md, STATUS-DELIVERY.md and STRUCTURAL-DELIVERY.md for the journal, review protocol and limits. NPCDex now has React source browsing and separate planning drafts, previewed desktop/recovery imports and a validated local RDX library. Full content authoring, cloud content synchronization and plan publication remain unfinished. See DESKTOP-MIGRATION.md for behavior, recovery and cutover limits. The original component showcase is at /foundation/.

YouTrack is the only application backend. No Payload, runtime GitHub storage, custom API server or proxy is permitted. No production data or credentials belong in this repository. Reader tokens live only in dialog memory; delivery tokens live only in the enabled page session.

Template provenance: 79d05e273dff44b1bba534752aeacb6aee071dc8. This is a fresh foundation, not recovery of historical commit e9ef385. The template remote retains its disabled push URL.

Notes editing now holds automatic task delivery while a text editor is focused, with a second check after asynchronous preparation. Each input still saves locally and explicit Save Changes can send a snapshot. The installed desktop also preserves predecessor baselines for continued typing during in-flight saves. See NOTES-SYNC-CORRECTION.md for preservation, exact behavior and acceptance evidence.

The October 23 Standby correction requires at least two all-Standby children for inherited Standby; exactly one stays In Progress. Web and backend source use statusRules 4. The installed desktop has the same correction and the approved @theGobindSingh metadata collaborator. A complete private backup preceded the code-only install. Normal Save Changes reports all services Up to Date with zero pending; the three formerly blocked metadata records are confirmed in the private cloud repository. See STANDBY-METADATA-REPAIR.md.

October 24 task-first migration: the owner wants an installed app on Chrome and
Firefox on Windows, hosted on Vercel. PMON tasks, notes, status, hierarchy and
attachments are the initial daily-work scope. The existing Vercel account is
signed in under PMON. A static-only shell deployment to Vercel is authorized by
the owner's hosting instructions; billing changes and repository-access grants
are not implied. Preserve all desktop data. See TASK-FIRST-MIGRATION.md for
actual checks and the remaining shared-status concurrency gate.

The hosted preview is available at https://romdex-web.vercel.app. Vercel is linked
only to the approved private ROMDex-Web repository and tracks the accepted port
branch. Hosted Chrome/Firefox shell, headers, asset integrity, offline notes and
synthetic attachment checks pass. Daily-work cutover still requires YouTrack
CORS setup and safe shared-status concurrency; see TASK-FIRST-MIGRATION.md and
CORS-ORIGIN-HANDOFF.md. The desktop remains untouched and authoritative.
