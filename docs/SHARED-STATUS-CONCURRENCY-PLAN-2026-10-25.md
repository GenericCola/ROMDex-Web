# Shared-status concurrency: issue SC-001

Owner direction: complete the web migration using efficient sequential role-scoped subagents, preserve desktop/data, use YouTrack as the only application backend, and consolidate fixes before another app installation. No reduced-safety one-browser cutover is approved. Hosted UI source 3e8c0db is deployed and its 34 hosted checks pass. Subsequent owner-authorized native Chrome reading passed with 396 PMON tasks; native attachment delivery remains unrun.

## Main Agent analysis and bounded gameplan

Observed facts: the native acceptance child race on NPCD-873 admitted both same-revision writers. Only one extension-property receipt remained. The same root case admitted one writer, so one success cannot establish isolation. Native correlated rollback is proven, but cross-request serialization is disproven. See docs/evidence/youtrack-native-2026-10-24/child-race.txt, native-results.json and docs/LIVE-ACCEPTANCE-2026-10-24.md. Existing failure evidence must remain unchanged.

Concrete cause boundary: youtrack-app/status.js reads assignedStatus via status-record.load, checks the expected snapshot, then replaces a single JSON extension property. Two requests can both pass before either replacement is visible. Revision increments and additional preflight reads cannot make that compare-and-write atomic. App/process/browser locks cannot coordinate all native requests or independent devices.

Next discriminating check: inspect current official JetBrains documentation for an explicit server-enforced compare-and-set, conditional update, uniqueness constraint, transaction isolation primitive or independent append-only entity suitable for app-owned status operations. Distinguish documented guarantees, code inference and unresolved native proof. Check supported storage APIs before proposing custom workflows, fields or visible comments. Absence from a limited search is not proof no API exists.

Smallest authorized action: a read-only Build-Audit Agent audit of these sources and the directly connected handlers/contracts. No implementation, test harness, app installation or live mutation in this assignment. Return one evidence-backed recommendation with acceptance checklist, migration/storage compatibility boundary, permission/UI consequences and the smallest native discriminating test if a viable path exists. If the evidence does not narrow a safe path, stop and report the exact open question; no speculative patch/retry loop.

## Scope and preservation

- Installed acceptance 1.0.12, app 155-84, Active only NPCD, auto-attach OFF.
- Future developer mutations limited to NPCD-872/873; this audit performs none.
- Production app source 1.0.8 withheld, production sharing OFF, PMON read-only during developer acceptance.
- Keep assigned choice distinct from native effective State, exact operation receipts, stale/reused ID handling, offline recovery, post-response readback and all-or-nothing correlated writes where promised.
- Status rules: Awaiting Testing / native Needs Testing inherits upward; all-Standby requires at least two children; exactly one Standby child yields In Progress; leaf keeps own choice.
- Do not remove/rename app storage or overwrite fixture receipts. No external backend/proxy/database, browser/process lock workaround, .env/token access or desktop changes.

## Model selection

Build-Audit Agent: GPT-6 Astra / low for bounded official-API and protocol audit. The user's observed Astra-low advantages are relevant but not a guaranteed ranking. There is no comparable measured outcome for this exact task; bounded investigation is the calibration. Data-safety consequences require explicit guarantees and no implementation based on assumptions. Escalate only if a documented capability gap remains; do not claim a running agent changed its model. Token usage unavailable until tooling provides it.

## Acceptance and queue

- [x] Inspect complete linked requirements and original child failure evidence.
- [x] Record official source links and exact guarantee/limits for candidate mechanisms.
- [x] Select one smallest justified path or record a concrete blocker and decision needed.
- [x] Preserve protocol requirements and identify actual native proof still required.
- [x] No code/native changes; bounded audit outcome recorded before further work.

Hosted UI private evidence backup verified: tag romdex-web-hosted-ui-qa-2026-10-25 peels to 0d7494209205ea6190880ba4eac515b6cc5d4dd4; deployment branch remains 3e8c0dbf1092ff68867b91216d49494b302b1ea3. The bounded SC-001 audit is complete; the issue remains blocked on a supported conditional-update guarantee. The owner selected preparing the JetBrains support request first; the draft and verified synthetic-evidence packet are ready but unsent. Authenticated Chrome reading passed separately. Native attachment acceptance, Windows installation and reviewed desktop export/import remain pending.
