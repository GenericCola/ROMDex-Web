# Sync without polling (PMON-641)

Owner answer P3 on PMON-622 (2026-11-07): "There should be no polling in the
whole app. If there is polling, research ways to do it in a better way without
polling." This page lists every timer the app had, what replaced each poll, and
what true push from YouTrack would need.

## What ROMDex reads now, and when

ROMDex reads YouTrack only when something suggests the data changed:

| Event | Task list (PMON issues) | ROMDex/NPCDex data articles |
|---|---|---|
| Delivery connects (sign-in, page open) | Full read | Full sync |
| Window comes back into view, or gains focus | Light check | Sync, at most once per 30 s |
| Browser comes back online | Light check | Sync |
| This window's delivery finished | Light check | – |
| A local change touches article data (assigned status, order, images, NPCDex) | – | Sync 5 s after the last change |
| A local change touches nothing the articles hold | – | Nothing is sent |
| Refresh button in the header | Full read | Sync |
| An editor closes or the queue changes | Re-applies the last read, no request | – |

A hidden window reads nothing. A visible window that nobody touches reads
nothing either; the Refresh button, or switching back to it, brings it up to
date.

**Light check.** One request: `issues?query=project: PMON&fields=idReadable,updated`.
It returns every issue's id and update time (about 20 bytes per issue), so it
sees edits, new issues, deletions and moves out of the project, wherever they
are in the list. If nothing changed, nothing else is read. If up to 10 issues
changed, only those are read, one request each. Otherwise, or when an issue
can no longer be read, the full list is read. The old check looked only at the
10 most recently updated issues, so it could not see deletions; that is why the
old code also re-read everything every 5 s.

**Full read.** Pages of 500 issues instead of 100, so PMON (about 490 issues)
is one or two requests instead of five.

## Timer inventory

### Removed (were polling)

| Where | What it did | Now |
|---|---|---|
| `src/cloud/watch-incoming.ts` | Re-ran incoming sync every 3 s while visible; a top-10 "updated" probe, and a full read of all issues every 5 s. Backed off to 60 s on errors and kept retrying. | Event-driven, see the table above. A failed read shows its message and waits for the next event or Refresh. |
| `src/store/browser/auto-sync.ts` | Synced both article stores every 5 minutes, and 5 s after any workspace change (two article reads each time). | Sync on start, online, focus/visibility (at most every 30 s), Refresh, and 5 s after a change that touched article data. |
| `src/cloud/watch-outgoing.ts` | Re-checked outgoing work every 60 s so an uncertain upload was read back. | Re-checked on focus, visibility and online (the readback itself still runs at most once a minute per upload). |
| `src/components/romdex/use-session-expiry.ts` | Checked the session every second. | One timer at the session's expiry, re-armed when the session changes; focus and visibility still check at once. |
| `src/components/romdex/use-save-overdue.ts` | Re-evaluated the overdue save light every 15 s. | One timer for the moment the oldest unsaved change becomes overdue. |

### Kept (not polling)

| Where | Why it stays |
|---|---|
| `src/domain/save-queue.ts` | 200 ms quiet period before a workspace save, so fast typing writes once. One-shot. |
| `src/store/browser/auto-sync.ts` | 5 s settle timer after a local change. One-shot debounce. |
| `src/cloud/watch-incoming.ts` | 250 ms settle before re-applying the last read after an editor closes. One-shot, no request. |
| `src/cloud/outgoing-scheduler.ts` | 750 ms settle before automatic delivery. One-shot debounce. |
| `src/components/romdex/single-window-lock.ts` | 10 s fallback: "Use here" takes the window lock if the other window never answers. One-shot. |
| `src/components/romdex/use-delayed-flag.ts`, `use-delayed-row-open.ts` | The 250/400 ms loader delay and the delayed row open. One-shot UI timers. |
| `src/domain/editing-window.ts` | Editor idle lease. One-shot. |
| `src/components/romdex/use-task-drag.ts` | 32 ms auto-scroll while a drag is held near an edge. Animation, only during a drag. |
| `src/auth/popup.ts` | Checks every 500 ms whether the OAuth sign-in popup was closed. Browsers fire no event when a cross-origin popup closes, so this is the only way to notice; it runs only while the popup is open. Nothing in the app calls `signInPopup` today (sign-in uses a pasted token), so it could be deleted with the OAuth flow. |
| `src/components/pwa-controls/check-update.ts`, `request-update.ts`, `src/rdx/worker-client.ts` | Timeouts that end a wait (update check, worker request). One-shot. |
| `src/components/romdex/rdx-actions.ts`, `recovery-export.ts`, `src/attachments/download.ts`, `task-file-drop.tsx` | Deferred cleanup (revoke a download URL, clear a drop highlight). One-shot. |
| `src/domain/accepted/**` | Hash-pinned desktop code: RDX time limit and a download URL revoke. One-shot. |

Service-worker updates are checked by the browser on navigation and by the
"Check for updates" button; the app has no update timer.

## Could YouTrack push changes instead?

Short answer: not to a browser on its own. Sources and details are below.

- **No browser push API.** YouTrack 2026.2 documents no server-sent events,
  WebSocket or "subscribe to changes" endpoint for apps.
- **Webhooks exist, but need a server.** The Cloud "Webhook Triggers" app
  (https://www.jetbrains.com/help/youtrack/cloud/webhook-triggers.html) POSTs
  JSON for issue created/updated/deleted, comment, work item and attachment
  events to a URL, with a shared token. An administrator installs it and
  attaches it to PMON. Retries and delivery guarantees are not documented.
  A workflow could do the same with the scripting `http` module.
- **The relay is the missing piece.** A browser cannot receive a webhook. It
  would need: a Vercel function that checks the token, plus a push channel to
  the open windows. Options: Web Push (a per-browser subscription store, VAPID
  keys, the service worker shows or forwards the event), or a managed pub/sub
  service such as Pusher or Ably. Server-sent events from a Vercel function are
  a poor fit: function duration is capped (300 s on Hobby, 800 s on Pro), so
  every client reconnects often, and instances share no state.
- **Activities API** (`/api/activitiesPage` with `start` and categories) can
  list changes since a time, but has no category for deleted issues, so it
  cannot replace the light check.

The event-driven light check above costs one small request per window focus.
Push would only add value for a window that stays in view while someone else
edits PMON, and it needs an administrator to install the webhook app, a stored
secret, and a push service. That is owner question 12 on PMON-622.

## Verification

- `tests/unit/incoming-scheduler.test.tsx`: no request on a timer, idle for an
  hour; reads on connect, focus, visibility and online; nothing while hidden;
  editors re-apply without a request; nothing after stop.
- `tests/unit/incoming-refresh.test.tsx`: the light check finds a deletion of
  the oldest issue and an edit of an old issue, reading only the changed one.
- `tests/unit/store-sync-local.test.tsx`: a change that touches no article
  value sends no request.
- `tests/unit/save-age.test.tsx`: the overdue light needs one timer.
