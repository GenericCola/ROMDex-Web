# Stable session entry and persistent sign-in controls

## Report and cause

An existing session could resume while the initial sign-in screen was visible.
The disabled 30-day checkbox disappeared when verification completed. The app
then published the verified identity before its preferred project had finished
opening, which displayed the old project chooser during loading. If opening
failed, the chooser stayed visible and its retry action was not reachable.

The new checkbox is in the deployed code, so a stale cache is not required to
explain the report. No user browser data or production queue was inspected.

## Repair

- Initial verification and project loading share one stable “Opening ROMDex…”
  screen. Sign-in controls and the project chooser are not displayed during it.
- PMON opens automatically once the verified workspace is ready. An intentional,
  account-specific project preference remains respected.
- Opening failure shows “Connection needs attention,” a project-specific error
  and “Retry opening ROMDex.” It does not strand the user at the chooser.
- Connection Details contains a lasting “Keep this device signed in” section.
  Its unchecked choice requests 30-day access only when the user then clicks
  “Sign in again with YouTrack.” Merely opening it or checking it does nothing.
- Re-sign-in still waits for local draft saving and stops without clearing the
  identity or sending a login request if that save fails.

No token storage, server grants, queue handling or security permissions changed.
Existing sessions are not silently upgraded. No real OAuth grant was created.

## Verification

Four new transition regression tests fail against the previous implementation
and pass after the repair. Local source, test and server typechecks pass, as do
676 unit, 47 server and 30 worker/build/hosting tests. Changed-source lint passes.

The added browser spec covers delayed verification, delayed PMON opening,
project-read failure and retry, and actual top-level synthetic provider redirect
and callback navigation. It first signs in without persistence, then explicitly
requests persistence through the signed-in controls and returns directly to
PMON. The accepted harness uses synthetic network responses; no provider or user data
is used. Playwright skips interception after HTTP redirects, so the provider
fixture uses a fresh document navigation. The callback adapter asserts the real
handler returned 303 to the exact app destination and that the browser sent the
Lax fence and login cookies. It forwards the original Set-Cookie headers, then
uses a controlled document navigation instead of letting a redirect escape the
fixture. Native HTTP-redirect following is not claimed as browser coverage.

The hosted standard build and complete check pass. Targeted browser acceptance
passes 38 Chromium desktop/mobile cases and 18 Firefox cases, with one
intentional Chromium-only persistent-browser-restart skip. Both explicit online
and opted-in callback navigations return directly to PMON; the real handler
returns 303 with the expected destination and receives both browser cookies.
No server security checks or build/lint checks were weakened.
