# PWA foundation

The manifest, icons and safe-area layout support installation. Browsers without an install prompt show browser-menu instructions; iOS users use Share > Add to Home Screen.

Production builds inventory public exported shell assets and hash their content into the worker cache version. Worker installation must precache the entire inventory successfully. Requests with query strings, Authorization headers, remote origins, non-GET methods or paths outside that inventory bypass caching. YouTrack data, credentials and user content must never enter shell Cache Storage.

Updates wait for Reload to update. The worker refuses activation while another ROMDex window is open. Only the consenting page reloads. The task workspace locks editing and waits for durable saves before activation. A blocked or failed update releases the editing lock. Storage failures block activation and keep recovery export available. Activation deletes obsolete romdex-shell-* caches only. A failed new install leaves the current worker and cache usable.

The preview server applies public/_headers. A production static host must do the same. HTTPS and a root-origin deployment are required, along with YouTrack CORS permission for the eventual origin. Development is on port 3001 and production preview on 3000; never serve development through the production origin.

The cached shell is not offline application data support. The initial task workflow uses IndexedDB for tasks, drafts and pending operations, separate from shell Cache Storage. Optional session delivery journals uncertain requests in IndexedDB and blocks app updates during delivery. See STRUCTURAL-DELIVERY.md. Opt-in assigned-status sharing uses the included YouTrack app; see SHARED-STATUS.md. Desktop/recovery import and separate NPCDex draft storage are available; see DESKTOP-MIGRATION.md. Other shared metadata and content synchronization remain pending. Update preparation also flushes dirty NPCDex editors and refuses activation after an editor-save failure. Real iPhone/iPad and HTTPS deployment acceptance tests remain required.

The owner selected Vercel for eventual hosting on October 24, 2026. Configure the static export and equivalent response headers there when the cutover gates pass. The final origin, YouTrack CORS approval and hosted-device acceptance remain pending.

The first daily-work cutover targets PMON tasks, notes, status, hierarchy and
attachments as an installed app on Chrome and Firefox on Windows. Chrome offers
its install prompt/address-bar icon. Recent Firefox on Windows offers the
address-bar web-app button (Firefox 143+, and Microsoft Store Firefox 150+).
OS installation and launch still need actual Windows acceptance; an emulated
standalone media query verifies only the app's installed-status message.

`vercel.json` selects a static-only deployment of`out` with the same security
and worker response headers as the local preview. Node 24.x and pnpm 11.25.0
are pinned for source builds.`.vercelignore` excludes source-upload credentials,
private diagnostics and local browser/profile artifacts. A prebuilt static upload
uses the same headers with no install/build command and its archive root as the
output directory. No tasks, recovery exports or desktop profile files belong in
that upload. See TASK-FIRST-MIGRATION.md for the current deployment and cutover
checklist; the shared-status race still blocks migration of daily work.

The first hosting setup uses Vercel Drop for a prebuilt static shell. This avoids
requesting GitHub repository access while the account connector has no tools.
Vercel documents this flow at https://vercel.com/changelog/vercel-drop. The
static artifact contains the exported shell and a header-only hosting config;
it contains no desktop data, task exports or credentials. Future automatic
source builds can use the checked-in root vercel.json after a separate, scoped
GitHub connection is configured.

Browser installation references:
- https://support.mozilla.org/en-US/kb/web-apps-firefox-windows
- https://vercel.com/docs/project-configuration/vercel-json

Hosted acceptance on October 24 passed all 26 Chrome/Firefox checks. The exact
worker inventory and template hash were verified against every cached response.
The cloud build serves no application server or proxy. Vercel Toolbar injection
is disabled for ROMDex. Source maps are excluded from precaching because Vercel
blocks debug map responses; they are not runtime shell dependencies.
