# Direct desktop → web comparison

Reference: private GenericCola/ROMDex commit28c0ce4d449e655661dd7469999a6dc56779f28f. Ten files fetched and verified against exact Git blob hashes under ../romdex-desktop-reference. Repo docs say this Git snapshot predates installed October23 repairs; it is not presented as the entire installed-source archive. Crucially the same original mergeIncoming/applySyncResult code already exists in the web repo's accepted/core.mjs but was bypassed.

| Area | Original desktop source | Web divergence / safe reuse |
|---|---|---|
| Inbound refresh | workspace-runtime.mjs WorkspaceClock polls5s and wakes online/visible; workspace-engine.mjs143–147 gets full snapshot; core.mjs99–104 validates tree then **replaces remote list**, preserving operation bases and cached comments | cloud/incoming-merge.ts builds Map from every previous row and never deletes absent rows. Restore full visible-projection replacement, retaining local pending data and recoverable copies. Keep web account/project/epoch fences and3s probes. |
| External disappearance | core.mjs103 replacement removes absent remote rows automatically; no event log/webhook needed | Web stale rows accumulated, then entered parent aggregates. Retire absent clean cache from current view without claiming permanent deletion. |
| Pending deletion | server.mjs103–110 builds fresh tree, filters remaining to IDs still present, deletes only remaining leaves, marks op done | Web readDeletion rejected absent targets and persisted conflict. Restore idempotent current-snapshot omission retirement, retaining archived intent and separate retiredIds, no repeatDELETE. |
| Absent vs unreadable | youtrack.mjs66 maps404 to null; other errors throw; all()61–64 lists current project fully | Preserve typed401/403/network failures. A validated complete authorized list is the current projection, not proof of physical deletion. No removal on partial/pagination failure or wrong account. |
| Parent calculation | youtrack.mjs141–144 calculates from **fresh all() only**, deepest-first | Web joined stale cached children and blocked every parent. Fresh calculation projection must exclude retired cache; pending local-only rows remain recoverable separately. Still reject an explicitly observed live unknown child before a derived write. |
| Pending writes | workspace-engine.mjs56–59 serial durable transactions;170 immutable sent batch;175 applySyncResult removes only completed op IDs | Retain web durable journal/attachment receipts, serial storage and ID-specific acknowledgment; never overwrite newer unsent edits. |
| Conflicts | core.mjs55–64 field-level three-way: equaldesired no-op, unchangedbase accepted, only different samefield conflicts; workspace-engine192–200 missing editedtask requires retained-intent review | Same accepted reconcile already reused. Preserve genuine dirty missingtask review, not global pause for clean omitted cache. |
| Save lamp | core.mjs11–15 red only pending AND unavailable/manual/failure; app.mjs65–67 ties tooltip to workspace status | Web red for any pending queue/deferredcache. Latest user expected actual post-Save clean state, not just hue. Restore proper completion by removing stale debt; keep honest red for real unsaved/unresolved local intent. |
| Edit locks | workspace-engine67–69 creates a new op if earlier op inflight; controls remain available, immutable batch protects lateredit;179 clears inflight finally | Web added ticket/dependency locks and750ms automatic send; later five-minute editing hold/selective batches/release regressions repaired. Do not remove established safety blindly; reuse op-ID-specific immutable batch principle. |

Original indexTree core.mjs39–46 renders a task whose parent is outside the snapshot as a root for that projection without rewriting parentId. Web's extra missing-parent exception was not parity. Cycles/duplicate data remain invalid.

## Immediate repair direction
No new infrastructure. Full-snapshot projection refresh + fresh-tree parent calculation; archive absent cached records/dirty work, never treat archive as active child dependency. Restore original absent-target idempotency while preserving intent and HTTP safety. Existing missing task fixtures must now assert automatic clean retirement, not manually acknowledged deletion.

## Implemented boundaries
- Full validated membership reads and partial single-ticket reads are explicit separate modes; a partial editor read never retires other rows.
- A complete visible snapshot retires clean omitted rows into account-bound recovery history. Dirty/pending rows remain recoverable, not silently discarded.
- Parent calculations use only the fresh current tree. Historical missing-child copies are not dependencies. An explicit fresh child-link mismatch still defers the affected parent and persists separately across incoming refreshes.
- Snapshot membership/hierarchy/native-status changes request one normal derived pass through existing Auto-Sync/Save; read application itself creates no operation or HTTP write. Notes-only updates, acknowledgment echoes and unchanged polls do not create debt.
- Periodic full membership refresh is due after five seconds, observed on the existing three-second visible scheduler (about six seconds). Intervening ticks use a revision probe. A scheduled full read does not also send a redundant probe. Hidden/backoff/coalescing/account fences remain intact.
- Absent queued deletion targets are retired after exact readback plus validated full-snapshot absence. `retiredIds` records projection retirement separately from proven `deletedIds`/DELETE receipts. Original intent remains archived; no DELETE is resent for absent targets.
- HTTP failures, invalid pagination/full list, stale account/project/workspace responses, and genuine unresolved local writes remain guarded.

Actual desktop-browser fixtures use production CSS and synthetic transport, never live user queues. Installed Windows PWA acceptance remains a separate unverified environment gate. No event store, webhook, secret or YouTrack app configuration was added.
