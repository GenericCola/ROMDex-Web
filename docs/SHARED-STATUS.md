# YouTrack-backed assigned status

## Status as of 2026-11-07

On 2026-11-07 the owner decided that assigned status lives in the "ROMDex data" article (PMON-A-3). See YOUTRACK-STORAGE.md and CUTOVER-2026-11-07.md. The shared-status UI and its e2e specs were removed.

The romdex-status app source (youtrack-app/), the src/cloud/shared-status-* modules, src/youtrack/shared-status-client.ts and the installed acceptance app 155-84 are kept. They stay until the owner decides whether to retire them. The question is open in PMON-622.

The rest of this document is the historical design. It is not rewritten.

October 24 native acceptance gate: GenericCola now has verified app-update access. Acceptance 1.0.12 is installed as app 155-84, Active on NPCD only. API access, request-stream parsing, receipts, persistence and correlated rollback are verified, but the child race accepted two same-revision writers. Keep production sharing OFF and production source 1.0.8 withheld until supported atomic concurrency is implemented and natively retested. Preserve both synthetic fixtures and their receipts, all PMON tasks and the desktop app/data. See [LIVE-ACCEPTANCE-2026-10-24.md](LIVE-ACCEPTANCE-2026-10-24.md). The owner selected Vercel for eventual hosting; no deployment is performed by this checkpoint.

ROMDex Web can store assigned status in YouTrack app-owned issue properties. Each enabled web device reads the same assigned choice, while native State continues to represent the leaf or parent calculation. Existing browser-only workspaces stay unchanged until the user previews and enables sharing.

The production app source is in youtrack-app. It has no widgets, automatic workflows, external requests or separate server. All storage and endpoints run inside YouTrack. A separate fixture-restricted test app is installed in NPCD but inactive; see LIVE-ACCEPTANCE.md for the administrator blocker and current results. No production installation, production-data write or desktop-data import was performed.

## Installation and activation

Run pnpm package:youtrack to generate artifacts/romdex-status-1.0.4.zip and its SHA-256 file. The package contains exactly manifest.json, entity-extensions.json, status.js, capabilities.js, status-record.js and status-rules.js at its root. ZIP entries are deterministic and contain source only. No browser data, test content, tokens or desktop files are packaged. Node.js 24 is sufficient; packaging adds no dependencies.

The package targets YouTrack 2026.2 or newer. After separate deployment authorization, an administrator can upload it through YouTrack's Apps administration, enable the app and attach it to PMON. Keep the app name romdex-status and its assignedStatus property unchanged when upgrading. Removing the app or renaming its property deletes stored values according to [YouTrack's extension-property lifecycle](https://www.jetbrains.com/help/youtrack/devportal/apps-extension-properties.html). Preserve browser recovery exports and a YouTrack backup before changing that storage.

Live acceptance must use a separate synthetic project or disposable tenant with a test build whose project guard matches it. The shipped build accepts PMON only. Verify permission enforcement, CORS from the real web origin, field type and link names, workflow interaction, and simultaneous same-revision requests before enabling production sharing. The local transaction fixture does not verify YouTrack's deployed transaction isolation or GraalJS runtime.

In Connection Details, enable delivery for the current session. Save or review any existing queue and rollup work. Outstanding delivery reviews keep priority; shared-status setup appears after they are cleared. Preview shared assigned status reads the app and shows each task's browser and YouTrack choices without writing. Uninitialized metadata is labeled as native State.

Use YouTrack choices and enable sharing adopts the displayed shared values and archives different browser choices in recovery. Keep browser differences and enable sharing queues those differences against the previewed metadata revisions. Neither confirmation writes to YouTrack; the next Save or opted-in Auto-Sync delivers the queue. A stale workspace, changed account, missing task, incomplete hierarchy or pending operation blocks activation. Fresh web devices must enable sharing too.

There is no automatic downgrade to browser-only delivery after activation. An unavailable, incompatible or corrupt app stops delivery and keeps the queue. Tokens remain in page memory. Reload discards the token and retains sharing and Auto-Sync preferences.

## Shared storage and revision checks

The app owns one JSON string extension property on each issue. It records schema version, increasing metadata revision, assigned choice, last effective State and the exact request receipt that created that revision. A read without stored metadata returns revision zero and derives its initial assigned choice from native State. Reads never initialize, repair or overwrite storage.

The browser validates the issue identity, protocol, revision, receipt and current task snapshot. Previously stored metadata returning a lower revision is rejected. Missing or malformed storage is never treated as an empty document. A native State value different from the last recorded effective State is treated as a new external assignment; native edits that leave the same value cannot reveal a new assignment.

Each write carries a unique operation ID, its purpose and value, and the expected metadata revision, initialized flag, assigned choice, native State and task timestamp. The handler compares all expected values before changing anything. An offline assignment also compares its queued baseline revision with the freshly read revision; intervening app revisions require review even when the current choice matches the original baseline.

The handler accepts only PMON issues visible to the caller. Reads require READ_ISSUE. Writes require UPDATE_ISSUE and access to read and write the State field. The field must be a visible single State field and the mapped native value must already exist. No fields or values are created. The API's endpoint permission declarations are OR lists, so the write endpoint declares only UPDATE_ISSUE and the handler performs its additional checks itself.

Assignment writes change only app metadata. Effective writes recompute the target's status from the current server hierarchy, reject mismatched calculations, and update metadata and State in one handler transaction. App validation errors are returned before mutations. Unexpected exceptions propagate so YouTrack can abort the transaction; an HTTP error response alone is not used as rollback. Every contributing descendant must be visible, in PMON and have a readable State field. Cycles and trees over 1,000 tasks stop the write. The standard Subtask outward name parent for must be available. The web core and app source recognize Awaiting Testing and PMON's native Needs Testing as amber. Any testing child takes precedence in its parent's display and effective State, through all ancestors. Assignment metadata retains the ROMDex label; effective writes use Needs Testing. Standby is inherited only when at least two immediate children are all effectively Standby. Exactly one Standby child and mixed Done/Standby children produce In Progress. A leaf retains its own assignment. Recursive calculations use each immediate child's effective status. Leaf and parent assignments remain intact. Production source 1.0.6 and acceptance candidate 1.0.7 advertise statusRules 4; neither new archive has been installed live. The earlier handoff is withdrawn; see YOUTRACK-CONSOLIDATED-QA.md for the local gate and native limits. Historical production 1.0.4 remains preserved. The web client refuses older rule sets before reading or writing issue metadata.

An exact replay of the latest stored request returns its current snapshot without writing. Reusing that ID with a different payload is rejected. After later writes, the original frozen revision is stale and cannot replay the old request. This is not a general historical receipt archive; browser recovery preserves previous operations and requests.

## Delivery and review

The browser saves the full metadata request in the same IndexedDB transaction as the attempting marker before sending it. A local saving failure prevents the network mutation. The account binding, serial delivery lock, PWA update lock and multi-window revision check remain in force.

After a metadata POST, a fresh read must contain the exact operation receipt and matching assigned or effective value before acknowledgement. Matching a value alone cannot confirm an uncertain metadata write. Lost responses remain blocked across reload and require explicit readback. A manually rebased shared edit gets a new operation ID; the earlier attempt and payload are archived. Calculated rollups are recomputed instead of manually rebased.

For mixed edits, metadata assignment is sent before ordinary property changes. If the metadata write succeeds but a later step fails, readback or explicit rebase can finish the remaining properties without repeating the metadata write. Native title, notes and hierarchy edits retain the earlier adapter's check/readback behavior and concurrency limits.

Save refreshes shared metadata even with an empty queue. Auto-Sync does the same while idle only when enabled and connected. Full reads are paginated; metadata reads use batches of at most ten concurrent requests. Incomplete reads, missing known tasks or failed app responses stop the cycle. Effective-status work stays durable until its final fresh calculation is complete. Automatic delivery suspends on failure rather than retrying ambiguous mutations.

## Desktop fallback and remaining acceptance

The desktop executable, source reference, saves, credentials, assigned-status sidecar and migration archive remain intact. The desktop app does not read these new properties. Its native State changes are external edits from the web app's perspective. Avoid simultaneous desktop and web edits to the same tasks. Desktop-data migration and the desktop's former shared metadata provider are outside this checkpoint.

The browser and app implementation are fixture-verified; the production app is not installed. The separate acceptance app is installed but cannot execute while inactive. Server-side revision checks execute within YouTrack's transaction model, but actual simultaneous transactions and production workflows remain unverified. Other clients can still change non-status properties and hierarchy outside this protocol. This checkpoint does not claim atomic transactions across an entire project. API throttling and large-workspace latency remain unmeasured; one personal workspace is the intended load.

## API references

The app uses JetBrains' [HTTP handlers](https://www.jetbrains.com/help/youtrack/devportal/apps-reference-http-handlers.html), [extension properties](https://www.jetbrains.com/help/youtrack/devportal/apps-extension-properties.html), [transaction model](https://www.jetbrains.com/help/youtrack/devportal/workflow-transactions.html) and [State API](https://www.jetbrains.com/help/youtrack/devportal/v1-State.html). Native permission and field access follow the [app permissions](https://www.jetbrains.com/help/youtrack/devportal/app-permissions.html) and [Project API](https://www.jetbrains.com/help/youtrack/devportal/v1-Project.html) references.

## Verification

Original implementation checkpoint 0263655, verified on October 22, 2026: pnpm check passed type checking, lint, 83 unit tests and 8 worker/build checks. pnpm build produced the static PWA. The full browser suite passed 118 checks across Chromium, Firefox, WebKit, mobile Chromium and iPhone emulation; two desktop-layout checks were skipped on mobile as expected. The comment-recovery path also passed a focused WebKit and iPhone rerun.

Tests execute the packaged handler against synthetic transactions and independent browser stores. They cover stale revisions, exact receipts, offline conflicts, migration choices, missing or corrupt app storage, workflow failure rollback and browser-only compatibility. No real YouTrack mutations were used.

The package test verifies deterministic ZIP entries, CRCs, exact source bytes and checksum output. An independent Python ZIP reader also verified the then-current five source entries and SHA-256. The generated package remains outside Git and is reproducible with pnpm package:youtrack.

## Review

What this change does: Adds YouTrack-owned assigned choices with explicit browser migration, server-side revision checks and exact receipt recovery. It preserves separate native rollups and refuses native fallback when shared storage fails.

Looks good for the implementation checkpoint. Reviewed two independent device stores, offline edits, request durability, metadata provenance, migration evidence, permission boundaries, package contents and update locks for one personal workspace. Tests cover metadata revisions that change without native timestamp changes and retain browser-only mode compatibility.

Not checked: live installation, deployed GraalJS compatibility, real transaction isolation, tenant permissions, production workflows, real-origin CORS, large-workspace capacity or real-device installation. Production deployment requires a separate authorized step. Test-only installation was authorized and is tracked in LIVE-ACCEPTANCE.md.
