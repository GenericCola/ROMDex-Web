# Local save recovery

A failed browser save previously made the entire device body inert. Even the
store rejected view-only navigation. A storage quota error or another window
winning the revision check could therefore look like a frozen application.

While a loaded workspace has a local-save error, navigation can now change only
`view`, in memory. All other data must remain byte-equivalent. The existing
mutation, delivery, draft-flush and update guards remain in place. Task editing
controls become read-only, but task selection, tabs and workspace navigation
remain available. Dirty editors that cannot safely flush still prevent leaving
their unsaved draft.

The visible error includes recovery export and a local-save retry. Retry saves
current in-memory data using the original expected revision. It never reloads a
new revision to overwrite another window, clears storage, drops operations, or
resets the delivery journal. A revision conflict remains an error; export before
reloading. Only a successful durable save clears the local error.

Verification uses synthetic data only. The managed browser fixture renders the
actual candidate ROMDex components with the production CSS. It reproduces the
old blanket inert state and exercises navigation during delayed delivery, after
delivery failure, after local failure, safe retry success, conflicting retry,
and an actual recovery download retaining failed notes and queued operations.
The auth owner separately verifies actual cookie-session and autosync flows.
This is a reproduced failure mode, not proof of the user's original root cause.
