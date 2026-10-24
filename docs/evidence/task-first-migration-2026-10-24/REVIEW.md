# Migration checkpoint review

What this change does: Files are staged durably, uploaded with exact receipts and
byte verification, and deleted only through an explicit review/save flow. Vercel
receives a static shell; credentials and desktop data stay outside the artifact.

## Must fix before daily-work migration

1. Shared status can lose a concurrent assignment (`youtrack-app/status.js`).
   - What this is: A request compares the old revision and replaces one JSON
     extension property with the next record and receipt.
   - Problem: The native child race accepted both same-revision writers and kept
     only one receipt. Local transaction mocks cannot prove native serialization.
   - Fix: Establish a supported native atomic mechanism or implement a durable
     protocol that retains concurrent intent and exposes unresolved conflicts.
     Prove it with actual concurrent native requests before enabling sharing.
   - If we skip it: A device can report success while its assignment is lost.

The static preview can proceed with sharing disabled and no data migration.
The attachment review traced byte storage, metadata validation, journal ordering,
new-task ID remapping, uncertain delivery, recovery import/export and scoped cache
removal. The iPhone staging defect was reproduced and repaired with portable
byte records. Exact native multipart bytes are checked separately from mobile
Playwright interception. The final hosting-only repair passed nine worker/hosting
checks, 35 affected PWA browser checks and 26 real-origin Chrome/Firefox cases. No desktop files, PMON issues, credentials or production
app settings were changed.

Verdict: fix 1 before daily-work cutover.
Not checked: native attachment delivery, real-origin CORS and actual OS app
installation remain separate acceptance gates. Cache-removal UI boundary checks
are not inferred from the tested upload/download subset.
