# PWA foundation

The manifest, icons and safe-area layout support installation. Browsers without an install prompt show browser-menu instructions; iOS users use Share > Add to Home Screen.

Production builds inventory public exported shell assets and hash their content into the worker cache version. Worker installation must precache the entire inventory successfully. Requests with query strings, Authorization headers, remote origins, non-GET methods or paths outside that inventory bypass caching. YouTrack data, credentials and user content must never enter shell Cache Storage.

Updates wait for Reload to update. The worker refuses activation while another ROMDex window is open. Only the consenting page reloads. The task workspace locks editing and waits for durable saves before activation. A blocked or failed update releases the editing lock. Storage failures block activation and keep recovery export available. Activation deletes obsolete romdex-shell-* caches only. A failed new install leaves the current worker and cache usable.

The preview server applies public/_headers. A production static host must do the same. HTTPS and a root-origin deployment are required, along with YouTrack CORS permission for the eventual origin. Development is on port 3001 and production preview on 3000; never serve development through the production origin.

The cached shell is not offline application data support. The initial task workflow uses IndexedDB for tasks, drafts and pending operations, separate from shell Cache Storage. Optional session delivery journals uncertain requests in IndexedDB and blocks app updates during delivery. See STRUCTURAL-DELIVERY.md. Full metadata/conflict parity and desktop-data migration remain pending. Real iPhone/iPad and HTTPS deployment acceptance tests remain required.
