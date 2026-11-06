# Main consolidation: November 6, 2026

Main now contains the released ROMDex application and the histories of every
work branch present at the start of this consolidation.

## Sources

- Previous main: 866fd9785a8254ac38085910b19a80eba43636c6.
- Released application: 1961448e865e764134a526205f77bad582032978,
  codex/accepted-app-port.
- Drag QA: 2cf9b1f88fec6c8769573eeb88c06a21c5a65033,
  codex/drag-precision-qa-20261106.
- Session QA: d58cfb3a3fd31c0a69962e07c1ce25c571a05481,
  codex/session-synthetic-qa-20261105.
- Cookie runtime repair 0937cec4787dd56b219b3a7a74f7b589ef07c961,
  save isolation 56092befe7105fe83330af67f887cd210b27f0af and durable session
  64af736bf9b186b809b6f09e7a1205b498ec5ea6 are already ancestors of the
  released application.

## Merge resolutions

The application, tests, dependencies, active documentation and root deployment
configuration are kept byte-for-byte from the released application. Drag QA
contains the same application and test blobs. Session QA contains the same
application and test blobs as the earlier session release c2e643ee, before the
subsequent drag improvements.

Both QA wrappers and their original hosting configurations are preserved under
docs/qa-archive. The older drag QA note is preserved there too; the active note
retains the verified release results. archive-manifest.json records the original
commit, path and Git blob SHA for each archive file.

The QA configurations are deliberately not installed at the repository root.
Their wrappers rewrite hosting configuration, install browser dependencies and
run synthetic tests. The drag wrapper also copies test screenshots into build
output. They must only run in isolated QA previews and must not be promoted to
production. The existing .vercelignore excludes the archive from deployments.

No branch is deleted. No live task, credential, desktop file or access permission
is changed. The existing production branch remains codex/accepted-app-port.

## Verification scope

The merge changes only this record and archived QA artifacts relative to
1961448e. All application and test blobs remain identical to that release.
Its previous release evidence is in DRAG-PRECISION-2026-11-06.md; those historical
results are not presented as new checks. Fresh consolidation checks and build
outcomes are reported with the merge result.
