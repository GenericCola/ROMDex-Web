# SC-001: bounded storage concurrency audit — 2026-10-25

## Outcome

No safe implementation path was established within this bounded audit. Keep production sharing OFF and stop the repair loop pending a specific platform guarantee. The smallest next step is to obtain JetBrains' supported mechanism for conditional app-property updates, rather than substitute another unprotected read/check/write. No code or native tests were run. This is an audit disposition, not SC-001 resolution.

Exact question for JetBrains (prepared, not sent): In YouTrack 2026.2 app HTTP handlers, which supported API atomically commits an Issue extension-property replacement only if its previously read value/revision is still current, and rolls back a correlated native State update if another request wins? Are handler reads validated at commit, are conflicts retried with fresh handler execution, and what documented isolation/linearization guarantee applies? If no such API exists, is there supported app-owned independent-record creation with a server-enforced unique key and complete consistent enumeration, usable in the same transaction as an Issue update?

Decision needed from Main Agent/user: pursue that platform clarification, or explicitly authorize a redesigned conflict-log contract with different acceptance semantics. Do not approve a comment/workflow implementation merely because it retains more evidence.

## Evidence and boundaries

Read AGENTS.md and its resume, complete SC-001 gameplan, shared-status requirements, October 24 native acceptance, original child-race.txt/native-results.json, and production status.js/status-record.js/entity-extensions.json. Read required repository overview/conventions before this report. Candidate identities are the assignment's HEAD 0d7494209205ea6190880ba4eac515b6cc5d4dd4 and deployed UI 3e8c0db; this audit did not independently verify HEAD. A read-only git status invocation failed with "this operation must be run in a work tree"; no Git repair or mutation was attempted.

The child record shows two fulfilled same-revision writes and only one revision-3 receipt; the root's one-winner result does not negate this counterexample. Source loads one JSON string, compares the expected snapshot, then replaces it. Native rollback proves all-or-nothing behavior for that request, not isolation from competing requests. Adding a second read, a revision property, global storage, browser locks or a workflow guard would still require the missing server guarantee.

## Official sources and what they establish

Reviewed on October 25. Searches were limited to official JetBrains documentation; unrelated search hits were not used. Six relevant reference pages below plus the server-metrics search result were inspected. A guessed REST issue-resource page returned 404 and supplies no evidence. This limited search does not prove that no suitable API exists.

| Source | Documented capability | Limit for this task |
| --- | --- | --- |
| [App Package Overview](https://www.jetbrains.com/help/youtrack/devportal/app-overview.html) | Backend choices include ordinary entities, extension properties and app global storage; browser host storage is local. | No independent custom app-record store or concurrency contract is described here. |
| [Extension Properties](https://www.jetbrains.com/help/youtrack/devportal/apps-extension-properties.html) | App-declared properties support primitives and entity references; multi-value properties support entity references, not primitive arrays. Global storage uses extension properties too. App deletion or property removal/rename deletes values. | No documented CAS, unique key, atomic increment or concurrent Set insertion guarantee found. A JSON operation array still replaces one value. Entity Sets do not establish uniqueness by application operation ID. |
| [Transactions](https://www.jetbrains.com/help/youtrack/devportal/workflow-transactions.html) | Changes in one transaction commit together or are rejected; workflow changes join that transaction. | Atomicity is documented; serializable predicate reads, concurrent handler exclusion and commit-time CAS are not specified. Moving the comparison into a workflow cannot be accepted on this source alone. |
| [HTTP Handlers](https://www.jetbrains.com/help/youtrack/devportal/apps-reference-http-handlers.html) | Handlers use workflow APIs, scoped entities and storage. Endpoint permission arrays authorize any listed permission. Request headers are exposed. | Header access is not automatic If-Match enforcement. No concurrency-control option is documented. Async continuation is not a serialized per-issue queue guarantee. |
| [Issue](https://www.jetbrains.com/help/youtrack/devportal/v1-Issue.html) | addComment creates an IssueComment; comments are a native entity collection. Field/transaction inspection and commands are available. | These are viable building blocks for separate records, not proof of app-owned immutable records, operation-ID uniqueness or exactly-one-writer admission. |
| [IssueComment](https://www.jetbrains.com/help/youtrack/devportal/v1-IssueComment.html) | Comments support extension-property queries, visibility checks and logical deletion; privileged UI users can permanently delete them. | Query then create is not uniqueness. Comment existence is not immutable retention. Missing/hidden/deleted records cannot safely be treated as an empty log. |

## Concrete alternative considered, not recommended as a drop-in repair

A native comment per operation, with app-owned extension metadata, avoids deliberately overwriting the same JSON receipt container. This is an inference from independent entity creation, not native proof that concurrent additions preserve both records. It changes the design materially:

- Two operations can still both cite the same baseline. Keeping both is conflict detection, not the required one success and one 409. Sorting by server IDs/timestamps does not retroactively make an acknowledged winner safe when another concurrent record appears later.
- Native comments bring comment visibility, creation/edit/delete permissions and possible activity/notification effects. App property isolation does not hide the carrier comment. Current UPDATE_ISSUE and State-access checks cannot simply be assumed sufficient; all required checks must be conjunctive in the handler.
- Choosing a deterministic winner does not make a correlated State write reflect that winner atomically. A later reducer needs a concurrency guarantee too, or an explicitly weaker reconciliation contract. Custom fields/workflows have the same unresolved isolation question and add schema/administration interactions.
- Separate records need complete enumeration and an authenticated origin marker, canonical payload comparison, immutable operation identity, duplicate-ID handling and retained rejection/conflict evidence. An opId match must never acknowledge a different payload. Same-ID concurrent creates need server uniqueness or an explicit conflict result.
- Unbounded retention costs storage and read time. Compaction can erase evidence needed for old offline/replayed operations; a safe design needs durable tombstones/high-water marks and a specified replay horizon. Hidden/deleted records, app removal, renamed properties and restored backups must fail closed. Recovery exports cannot silently become server authority.

No comment, field, workflow, permission, UI or storage migration is authorized by this audit. Retain assignedStatus and both fixtures' historical receipts. If an atomic API is confirmed, prefer adapting the existing write boundary with no schema/UI migration, subject to actual API requirements. A redesigned log requires a versioned protocol, explicit old-queue handling and reviewed migration that preserves historical receipts; reads must not silently initialize missing storage. No new app installation is requested before consolidation.

## Smallest conditional native discriminator

Only after a supported primitive/contract is identified and a reviewed consolidated candidate exists: on NPCD-873, capture a fresh baseline and start two overlapping requests with different operation IDs and payloads but identical expected snapshot. Record request/response timing and exact response bodies, then independently read storage and native State. Required result: exactly one committed operation, the other 409, one revision advance, the winner's exact receipt, and no loser's correlated State effects. A single pair can disprove a mechanism; it cannot establish a universal guarantee. Repeat bounded overlap runs on both NPCD-872/873 with the supported guarantee as the design basis, not probabilistic tests as its replacement.

Then test same-ID identical replay, same-ID different payload under overlap, stale/offline revision, lost response plus fresh readback, and forced post-mutation rollback. Preserve complete original evidence. Test actual client error/readback selection and formatting paths; matching values alone cannot acknowledge a write. Any comment-log candidate would first need a separately approved acceptance contract; "both records survived" does not pass the existing discriminator.

All native steps above are UNRUN. No fixture changed. Acceptance remains 1.0.12/app155-84, NPCD-only, mutations limited to NPCD-872/873 in future authorized work. Production source1.0.8 remains withheld, sharing OFF. YouTrack stays the only backend; desktop/profile, PMON and unrelated Pokémon projects remain untouched.

## Requirement disposition and calibration

| Requirement | Disposition/evidence |
| --- | --- |
| Complete scoped requirements and original failure | Read; evidence/source boundary above. |
| Official mechanisms and guarantee limits | Audited; linked table. |
| Smallest safe recommendation or concrete blocker | BLOCKED on documented conditional-commit guarantee; exact platform question prepared. |
| Assigned choice distinct from rollup | Mandatory, unchanged; alternative cannot silently conflate them. |
| Exact receipts, replay/reused IDs, offline recovery, readback | Mandatory; migration/conditional checks above, no newly verified native pass. |
| StatusRules4, testing inheritance, minimum-two Standby, leaf choice | Preserve unchanged; no rule implementation inspected or modified for this storage audit. |
| Permission/UI/retention/recovery consequences | Recorded above; redesign not approved. |
| No implementation/native mutation/install | Honored; only this report written. |

Build-Audit Agent configuration: GPT-6 Astra / low, selected by Main Agent for bounded calibration using the user's observed advantages; no exact comparable cost evidence. Outcome: narrowed the safety blocker and rejected unsupported substitutions; no repair proposed as proven. One audit, no implementation retries or model escalation. Actual token usage unavailable; no savings estimate. Changed file: docs/SHARED-STATUS-CONCURRENCY-AUDIT-2026-10-25.md only by this agent. Builds/tests intentionally not run for this read-only investigation and documentation report.

## Main Agent follow-up: no silent loss versus one winner

A conflict-preserving append-only history could satisfy a narrower no-silent-loss goal without exactly-one-writer admission: retain both intents, mark the common-baseline fork as unresolved, and require explicit resolution before treating either as the shared assignment or sending a derived rollup. An acknowledged append must mean only "intent recorded", not "assigned status saved". Readers must surface the conflict and retain both exact receipts; uncertain writes remain recoverable. This is a potential design, not current acceptance and not proof of storage safety.

The algorithmic conflict contract is separate from the carrier choice. App-owned independent records would avoid comment-specific UI consequences if a supported API exists. Using native comments adds visible activity, permission/visibility and deletion/retention concerns already listed; those changes are not inherent to conflict-preserving history and need separate approval. Still unproven natively: independent concurrent record survival, complete consistent reads, detecting a fork before final acknowledgement, duplicate/reused ID treatment, retention across upgrades/backups and correlation with native State. A late-arriving branch means absence of a currently visible conflict cannot itself justify permanent success. Conservatively suspending rollup on detected conflict does not undo an earlier incorrect State write.

Smallest decision: preserve the current exactly-one-writer contract and seek JetBrains' atomic primitive clarification first (recommended). Alternatively, authorize a bounded design phase for "record intents, visibly resolve conflicts" with no promise yet that native comments are acceptable or that a platform guarantee has been established. That alternative changes product semantics; it does not authorize implementation, installation or production sharing.
