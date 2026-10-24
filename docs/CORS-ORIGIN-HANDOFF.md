# YouTrack browser-origin setup

Copy-ready administrator message:

Please add`https://romdex-web.vercel.app` to YouTrack's Resource Sharing > Allowed
origins (CORS). Preserve existing entries and keep Allow all origins OFF. No app
ZIP installation, PMON changes, workflow changes or attachment-limit changes are
requested for this step. Tell me when the origin has been added so I can repeat
the authenticated browser acceptance checks.

The hosted shell passed 26 Chrome/Firefox checks. Anonymous preflights for its
exact origin currently return no Access-Control-Allow-Origin or authorization
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
