# Attachments in the task web port

Files are staged in a separate browser IndexedDB store. Staging saves verified
bytes before adding the upload request to the workspace journal. Save Changes
sends supported requests only after the owner enables session delivery.

Server sign-in uploads are limited to 4,000,000 bytes per file. Direct token
connections retain the tenant's 10 MiB limit. A connected file selection checks
the effective limit before staging any of its files. Older
recovery files up to 50 MiB remain readable and exportable, but oversized uploads
stop before an attempt is recorded or a network mutation is sent. Staged bytes
are limited to 64 MiB per browser workspace. Keep original files and recovery
exports; browser storage is not a backup service.

Downloads refresh exact attachment metadata and allow only the YouTrack tenant's
file endpoints. They omit cookies, bypass caches, refuse redirects and require
the exact advertised byte count. Upload confirmation additionally verifies the
returned attachment ID, filename, size, author and SHA-256 content hash.

Remove opens a review dialog showing the task, filename, ID and size. Cancel
sends nothing. Confirmation queues a deletion; connected Save Changes performs
it only if the exact attachment metadata still matches. Recovery cannot recreate
a deleted native attachment ID.

A lost upload or deletion response holds the affected ticket while unrelated
eligible changes continue. Restarting does not resend it. Uploads get automatic
read-only confirmation on reconnect and while Auto-Sync is enabled, at most once
per minute per pending operation. Confirmation requires a new attachment ID
against the saved pre-upload inventory, matching filename, size, author and
SHA-256 bytes. A missing receipt can be discovered only from one unambiguous
candidate. Overlapping identical pending uploads and claimed receipts prevent
automatic discovery; a receipt cannot confirm two operations. Failed reads,
missing baselines and mismatches preserve the queue and staged bytes for review.
Connection Details retains explicit review controls. Deletion absence requires an explicit acknowledgement
that the owner checked the exact file and their access. Stopping a request
archives its evidence. Re-staging after review is an explicit new operation.

Select up to ten files at once or add more later. Additional uploads can be
staged while earlier uploads on that ticket await confirmation; they stay local
until the hold clears. Repeated identical selections remain separate operations
with separate IDs and receipts. There is no automatic file deduplication.
Unsent additions can be cancelled individually when delivery is idle. Structural
and other ticket review locks remain in force. The cumulative staged-byte limit
stays 64 MiB, and a partial storage failure retains its successfully staged prefix.

The save light stays green during ordinary pending work and delivery, with text
distinguishing local saves from YouTrack confirmation. Local save errors,
unresolved review and paused-delivery errors turn it red immediately. Otherwise
an item waiting ten minutes turns it red. Ages track each operation independently;
new edits do not reset older work. Reopened work with no known age gets ten
minutes from observation. This allows the existing five-minute focused-editor
delay without treating normal typing as a failed save.

Recovery exports include staged bytes and hashes. Import verifies these before
storing them, retains uncertain-request review requirements, disconnects delivery
and leaves Auto-Sync off. Missing original bytes remain queued metadata and
must be restored from a matching file before delivery. Archived staged copies
can be reviewed and removed separately; active upload bytes are excluded.

## Verification boundary

Ten attachment unit checks and the rendered browser checks cover durable staging,
restart, exact downloads, new-task ID remapping, cancelled/reviewed deletion,
lost-response review, changed-metadata refusal, recovery transfer, corruption,
missing bytes, upload limits and token-origin protection. See
[TASK-FIRST-MIGRATION.md](TASK-FIRST-MIGRATION.md) for current final-run evidence.

The automated failure-path suites use intercepted synthetic PMON IDs. Under the
owner's later authorization, native Chrome and Firefox acceptance also passed on
private disposable PMON-467/468 beneath test-only Epic PMON-466. Native upload,
exact-byte download, reviewed deletion and actual CORS passed; interrupted Firefox
readback recovered without resending. See NATIVE-ATTACHMENT-ACCEPTANCE-2026-10-25.md
for provenance and unrun native error branches. The separate shared-status
concurrency failure still blocks daily cutover.

New staged files are stored as ArrayBuffer byte records, then reconstructed and
hash-verified when read. This fixes the iPhone browser runtime's rejected File
records. Existing Blob records remain readable; Chrome and Firefox explicitly
exercise that legacy read path in the offline/reload test. No desktop store or
source file changes.

Mobile Playwright interception omits multipart file contents. The iPhone fixture
therefore sends the actual app-generated FormData to a bounded local-only test
receiver and checks its complete wire bytes before completing the intercepted
YouTrack fixture. The receiver exists only in test global setup and is never
included in the Vercel artifact. A separate native multipart check confirms this
transport behavior. Physical iPhone acceptance remains pending.
