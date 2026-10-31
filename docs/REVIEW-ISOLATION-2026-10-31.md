# Review isolation and legacy deletion repair

## Changes

A legacy deletion can list a parent but omit cached descendants. When an exact
read and a complete, validated, same-account project snapshot both omit a cached
child, completing the original parent intent no longer fails on that child.
Only the original deletion targets are retired. Child edits, drafts and cached
content stay recoverable; no child is silently added to a DELETE request.

Known pre-request conflicts and missing-task reviews are scoped to the affected
tickets and hierarchy dependencies. Independent edits, comments, files and
parent calculations can proceed in either queue order. Authentication failures,
failed reads and newly uncertain write outcomes still stop the current batch.
An uncertain request is never automatically resent.

Derived parent changes on a reviewed branch remain queued and visible. Other
branches can finish. Resolving the review wakes the deferred work; an unchanged
held branch does not cause an automatic retry loop. A held creation at the front
of the queue no longer starves an eligible independent operation.

Choosing a local version only saves that choice in the browser. Its durable
`ready` record survives reopening and prevents Auto-Sync from sending it before
explicit Save Changes. Other tickets can still sync. The same rule applies to
replacement edit IDs created by tag/shared-status review. Existing hierarchy
recovery quarantine and identity/project checks remain in place.

## Verification scope

Regression coverage includes legacy serialized queues, both operation orders,
multiple reviews, attachment preflight and lost responses, creation dependencies,
independent derived branches, dynamic ticket locks, review resolution, and repeat
runs. Browser fixtures use the real app/adapter with synthetic transport; they do
not write to live YouTrack tickets. Release evidence records final test counts,
source hashes and browser outcomes separately.

The earlier real Chromium service-worker old-to-new upgrade preserved scoped
IndexedDB queues, drafts and attachment bytes. The workspace harness used current
runtime code with synthetic cookie responses, not a full old-runtime migration.
Physical Windows installed-PWA launching remains unverified. No new credentials,
permissions, webhooks, storage service or dependency were introduced.
