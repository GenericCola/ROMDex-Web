# JetBrains support request

Submitted October 25, 2026 with owner authorization. See JETBRAINS-SUPPORT-SUBMITTED-2026-10-25.md for confirmation and the exact submitted variant. Original prepared draft follows.

Submit through [YouTrack Support](https://youtrack-support.jetbrains.com/hc/en-us/requests/new?ticket_form_id=66282). Copy the subject and message below and attach `ROMDex-YouTrack-Concurrency-Evidence.zip` from this folder.

## Subject

YouTrack Cloud app HTTP handler: concurrent revision-checked extension-property writes both succeed — supported atomic update mechanism?

## Message

Hello YouTrack team,

We need guidance on preventing lost updates in a YouTrack Cloud app before enabling it for production work.

Instance: https://thegobindsingh.youtrack.cloud
App: romdex-status-acceptance, ID 155-84, active only on NPCD. It is restricted to two synthetic issues, NPCD-872 and NPCD-873. Production sharing remains disabled.

On October 24, our native acceptance widget dispatched two issue-scoped POST requests concurrently using Promise.allSettled. Each had a different operation ID and assigned-status value, but the same expected metadata revision and issue snapshot. The handler reads one string extension property, validates the expected snapshot, then writes a replacement JSON record containing revision + 1 and the exact operation receipt.

Observed on NPCD-873: both requests fulfilled. Fresh readback contained revision 3 and only one receipt, from an expected revision-2 request. The surviving assignment was Open. The other competing request asked for In Progress. Our acceptance check correctly failed. A control pair on NPCD-872 produced one success and one 409. We have one failing pair and one control pair, not a measured reproduction rate.

The functional native test ran on app 1.0.11. Current installed app 1.0.12 has the same functional handler, storage schema, utilities and acceptance widget; its changes were the manifest version and removal of temporary diagnostic logging. The attached 1.0.12 archive is the preserved exact package, not a newly proposed update. Its minimum target is YouTrack 2026.2.0; the actual Cloud server build was not independently recorded. Please confirm the relevant server build on your side.

Separate native testing verified that an uncaught exception after changing both this property and the issue's State rolls back both changes. We understand that transaction atomicity does not itself guarantee isolation between requests. The failing pair used assignment-only operations, so it does not establish whether adding a correlated native State mutation changes the platform's conflict behavior.

What supported mechanism should we use to atomically replace an Issue extension property only if its previously read value/revision is still current?

Specifically:

1. Are app HTTP-handler reads validated at commit? Can two requests both commit after reading the same extension-property value? Are conflicts retried with a fresh handler execution?
2. Is there a supported compare-and-set, conditional update, lock or isolation API that can also roll back a correlated native State change when the comparison loses? Does any HTTP conditional header apply to app handlers automatically?
3. If no such mechanism exists, is there supported app-owned independent-record creation with a server-enforced unique operation key and complete consistent enumeration, usable in the same transaction as an issue update?

Our intended contract is one committed operation and an explicit conflict for the loser, with an exact retained receipt for lost-response recovery. We need the documented guarantee and a minimal supported example. A process-local lock, extra preflight read, or moving the same check into a workflow would not be sufficient without a platform guarantee.

The packet includes the original failed widget output, a small native-result excerpt, the preserved acceptance package and the relevant handler source. It contains only synthetic-fixture evidence and app source; no credential, browser storage, production-task content or desktop profile is included. No change to our instance is requested by this support message. Please advise before any further test or configuration change.

Thank you.

## Attachment identity

The evidence ZIP and its member hashes are listed in `support-packet-manifest.json`. The enclosed acceptance package SHA-256 is `6f3cc6881dbbdccd51c98407d85da03119e45269f19ed7cd67bf43b53dfdd063`.
