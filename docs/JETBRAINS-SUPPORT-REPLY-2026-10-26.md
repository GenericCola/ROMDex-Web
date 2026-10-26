# JetBrains response: shared-status concurrency

Received October 26, 2026 at 7:13 a.m. America/New_York (11:13:43 UTC), from Dmitrii Koval, YouTrack Support. Re-read through Gmail MCP during the port-status reconciliation. Ticket 9288924; Gmail message/thread 1a177ea936ee6cde. This is a substantive answer, not an automatic receipt.

[Support ticket](https://youtrack-support.jetbrains.com/hc/requests/9288924) | [Email](https://mail.google.com/mail/u/?authuser=mrgenericcola%40gmail.com#all/1a177ea936ee6cde) | [Related issue JT-98787](https://youtrack.jetbrains.com/issue/JT-98787)

## Confirmed findings

- App HTTP handlers read their starting snapshot. Concurrent changes do not cause read validation or a fresh handler retry; both requests can succeed and the later write can overwrite the earlier value.
- There is no supported app compare-and-set or lock API. If-Match is not automatically enforced for these handlers.
- Adding a native State mutation does not provide isolation. All-or-nothing rollback within one request is distinct from protection against another request.
- Overwriting an existing extension property does not advance the issue updated timestamp, so it cannot act as a reliable conflict token for that metadata.
- No supported app-owned independent-record creation with server-enforced unique operation keys was offered.
- Support reviewed the code and said JT-98787 should cover this issue-scoped case too. No supported workaround or fix was available in this response. They advised against relying on concurrent extension-property writes for production data.

## ROMDex disposition

SC-001 is confirmed and open. Production sharing remains withheld; another app ZIP alone cannot repair the platform guarantee. The next action is a design decision that respects the current YouTrack-only backend constraint, or explicit approval to change that constraint/contract. A conflict-history proposal remains unproven and unapproved; it is not a drop-in fix. Keep existing metadata, receipts, desktop data and queues intact.

Support requested no further information. The reply monitor was deleted after the answer was delivered to the owner. No further support message, app update, YouTrack setting change or desktop/data mutation was sent/performed during this reconciliation.
