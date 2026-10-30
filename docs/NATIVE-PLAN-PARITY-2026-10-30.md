# Native RDX plan review

The original desktop `PlanWorkspace.reconcile` and `plan-import-view.mjs`
provide native-to-plan reconciliation and explicit conflict decisions. The web
host previously had neither `sync-review` nor `resolve-native` handlers. They
now use the original `pullPlan` implementation and original review dialog.

Review is explicitly opened from the retained plan list. It reads the currently
signed-in PMON account's tasks, complete comment and attachment inventories, and
verified attachment bytes. It does not dispatch any YouTrack mutation. Native
changes without local conflicts can update the local working plan, as in the
desktop implementation. Conflicts require a choice for every field and an exact
review token. Accepting a decision reads the evidence again; a changed remote or
local baseline invalidates the decision rather than applying an old preview.

The prior RDX version is retained. The new container and native bindings are
saved in one workspace transaction, guarded by the exact opened workspace and
the current identity/session. Closing the dialog invalidates pending work.
Existing dialog draft/PWA/account-switch guards continue to apply. Native reads
are bounded to 100 tasks, 100 files per task, 50 MiB per file, 64 MiB total bytes,
and a three-minute checked budget. Requests retain their existing timeouts.
A failed or oversized read leaves the plan unchanged. These repeated reads are
not a server-wide atomic snapshot guarantee.

Fixtures cover conflict-token freshness, explicit decisions, changed local
workspace, cancellation/logout, missing tasks, changed native inventories, and
byte budgets. The managed browser fixture verified the original conflict view,
refusal without a choice, and accepting a native title into the retained local
plan. Its fetch handler rejects all non-GET methods. No production task writes
were used.

Remaining differences: background automatic native-plan refresh is not mounted;
this path is explicit review. RDX tag mapping/publication, large-scope resumable
file checkpoints, linked map/package UI, and the RDX v1 inability to represent
Awaiting Testing remain separate gates. NPCDex is untouched.
