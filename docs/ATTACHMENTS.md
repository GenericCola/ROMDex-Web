# Attachments in the task web port

Files are staged in a separate browser IndexedDB store. Staging saves verified
bytes before adding the upload request to the workspace journal. Save Changes
sends supported requests only after the owner enables session delivery.

New files are limited to the tenant's unchanged 10 MiB upload limit. Older
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

A lost upload or deletion response blocks delivery. Restarting does not resend
it. Connection Details can read the current attachment IDs and confirm an exact
upload by matching bytes. Deletion absence requires an explicit acknowledgement
that the owner checked the exact file and their access. Stopping a request
archives its evidence. Re-staging after review is an explicit new operation.

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

Browser tests use intercepted synthetic PMON IDs, never live PMON tasks. Native
YouTrack attachment delivery and real hosted-origin CORS remain pending. The
shared-status concurrency failure is separate and still blocks daily cutover.
