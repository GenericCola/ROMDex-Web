# YouTrack browser-origin setup

October 24 update: the owner reports the administrator completed the origin
allowance. Anonymous preflights from the exact Vercel origin now return
`Access-Control-Allow-Origin: https://romdex-web.vercel.app`, the requested
GET/POST/DELETE method and `authorization,content-type` permission. No token or
issue mutation was used for this verification. This establishes the preflight
boundary; authenticated browser reading and fixture delivery remain separate
acceptance checks. The anonymous response cannot prove the full administrator
settings inventory or permissions.

The original request below is retained for provenance. No further app install
is requested. Shared assigned-status concurrency still blocks production
sharing and desktop cutover.

Copy-ready administrator message:

Please add`https://romdex-web.vercel.app` to YouTrack's Resource Sharing > Allowed
origins (CORS). Preserve existing entries and keep Allow all origins OFF. No app
ZIP installation, PMON changes, workflow changes or attachment-limit changes are
requested for this step. Tell me when the origin has been added so I can repeat
the authenticated browser acceptance checks.

The hosted shell passed 26 Chrome/Firefox checks. Before the administrator update, anonymous preflights for its
exact origin returned no Access-Control-Allow-Origin or authorization
header permission. The current account's Global Settings page did not expose
Resource Sharing, and a plain browser API page was unauthenticated. No tokens
were extracted and no CORS settings were changed.

The official [Resource Sharing documentation](https://www.jetbrains.com/help/youtrack/cloud/server-configuration-settings.html#resource-sharing)
describes the setting. The documented REST resource is
`/api/admin/globalSettings/restSettings`, with`allowAllOrigins` and
`allowedOrigins`; use normal administrator tooling if the UI does not expose it.
Never paste tokens or credentials into chat.

This origin allowance does not complete daily migration. Shared assigned-status
concurrency still needs repair and native acceptance before production sharing
or desktop cutover. The installed acceptance app remains 1.0.12 on NPCD only.
