# Active PMON quarantine amendment — October 25, 2026

The owner explicitly corrected the scope: "You can create synthetic disposable tasks for testing in PMON in a quarantined Test-only EPIC". PMON attachment support is required for day one. This authorizes new test-only PMON descendants, not edits to existing production tasks or production status sharing.

Main Agent created and independently read back via MCP:
- PMON-466: [ROMDex TEST ONLY] Quarantined web migration acceptance; Type Epic, no parent.
- PMON-467: Chrome attachment acceptance; parent PMON-466.
- PMON-468: Firefox attachment acceptance; parent PMON-466.
All three are private to GenericCola, State To do, Priority Minor, Complexity LOW. Existing project automation assigned GenericCola. All attachment inventories are empty. No existing task, schema, workflow, status app or desktop file was changed.

## Active implementation plan

The unexecuted NPCD alias plan below is superseded. Preserve its three diagnostic files and offline29 evidence before adapting the runner; never execute the old alias path. Use actual PMON-467 for Chromium, then PMON-468 for Firefox, beneath PMON-466. No synthetic responses, identity aliases or project rewriting remain. Every API response must be native and unmodified.

Only narrow the normal task-list query through the test transport guard to `project: PMON issue ID: PMON-466, PMON-467, PMON-468 sort by: created asc`. Main Agent verified this exact query through MCP and the official Search Query Reference. Keep all fields/pagination intact, and refuse any returned nonallowlisted task or unexpected parent/project/title. Permit read-only task detail GET only for these three IDs. This gives a fresh isolated browser workspace with the real test Epic and children; no production work is imported. Production code and its PMON guards remain unchanged.

All prior network/body/receipt/CORS/secret/no-retry guards still apply, now to the actual PMON target without ID substitution. No task creation, update, deletion, hierarchy/status write or app endpoint may pass the browser guard in this attachment assignment. One tiny exact file POST to the selected child, then only reviewed DELETE of its exact newly returned ID. GET users/me, exact fixture issue/list reads, attachment metadata/list and exact registered file URL only. The runner uses real token entry for both task reading and session connection; no mocked token/account/response. Observe actual native identity/hierarchy, read message, browser-save/import and selected task before staging.

Acceptance remains stage disconnected, reload/export exact bytes, connect with Auto-Sync OFF/sharing OFF, native empty listing, one explicit Save, exact upload receipt/metadata/author/hash, download, Cancel with zero DELETE, reviewed queue with zero DELETE before Save, one explicit Save and native absence, disconnect/reload. Main Agent records before/after MCP preservation for all three fixtures. NPCD and its metadata receipts now remain entirely untouched; the saved-token wrapper must remove obsolete NPCD metadata calls before use.

Read-only source/API research and test harness work are permitted; no live run by Build-Audit Agent. Main reviews frozen harness and offline refusal cases before native execution. Do not broaden this assignment to creation/status/hierarchy tests yet. SC-001 remains blocked pending JetBrains clarification; production sharing OFF.

---

## Historical NPCD bridge plan — never executed

# Native attachment acceptance plan

Owner direction: proceed with migration. Preserve desktop/data, real PMON work, production sharing OFF, and the existing NPCD-872/873 fixtures and status receipts. The owner previously authorized synthetic testing on these two issues and loading the saved token for the webapp. No support message sending or new app install is requested.

## Main Agent analysis

MCP readback confirms both fixtures remain private to GenericCola, Done, with their original text/hierarchy and zero attachments. The connector has no attachment mutation or download tool. The production app deliberately accepts PMON task identities; widening those guards merely for testing would change the product's safety boundary. Existing browser fixtures already prove the rendered staging/journal/recovery paths, but their attachment transport is synthetic.

The smallest next discriminator is a test-only transport bridge around the unchanged hosted app. Use a fresh automated browser context at the actual Vercel origin, a single explicitly labelled synthetic task alias PMON-900001, and replace only task-context reads with that synthetic record. Forward actual browser attachment requests to exactly NPCD-872 in Chromium, then NPCD-873 in Firefox. Attachment request bodies, responses, exact receipts, file metadata/author and bytes must remain native and unmodified. This proves the attachment protocol and rendered handling with a substituted task context; it is not full native task/hierarchy acceptance or permission to cut over.

## Required guard and acceptance checklist

- No application source, PMON guard, deployed bundle, project setting, status app or desktop changes.
- Test runner is not included in any build/deployment or default test suite. Fresh ephemeral contexts only; no existing Chrome/Firefox profile or preview touched.
- Explicit invocation and fixture/browser allowlist; no automatic live retries. Read credential through stdin only, never CLI arguments, persisted files, logs, traces or HAR. No credential access by Build-Audit or Test-QA Agent.
- Deny every non-GET YouTrack request except one exact tiny synthetic attachment POST and its later explicitly reviewed DELETE of that newly returned attachment ID. Reject all real PMON requests and all other issue paths; allow only GET users/me and exact returned attachment file addresses on the approved tenant. No redirect forwarding.
- Fail closed unless native baseline list is empty; preserve any existing file and stop. Read only both allowlisted issue baselines with MCP before execution. Any failure stops, retains sanitized receipt/recovery evidence and performs no automatic cleanup or resend.
- Preserve browser CORS: use actual browser network continuation, never Node/route.fetch/fulfilled responses for native attachment/account/file traffic. Synthetic task context reads must be explicitly labelled in report.
- Verify actual generated multipart contains the exact expected filename and bytes before permitting POST; exact receipt ID retained, returned metadata/author and SHA-256 bytes checked by the unchanged app.
- Stage while disconnected; verify local export bytes and reload persistence. Connect session, read empty native inventory, explicit Save once, verify actual confirmed UI message, exact download bytes and native inventory.
- Open deletion review then Cancel: zero deletes. Review again; queue exact new-file deletion; zero deletes before Save. Explicit Save once; native absence readback, exact confirmed UI, reload persistence. Disconnect session.
- Record source/build identities, exact visible status messages, sanitized path/method/status/CORS receipts, file hashes and screenshots after token field is empty. No signed URLs, headers containing credentials, browser storage dump, or plaintext secret in evidence.
- No mutation to issue text, State, hierarchy, metadata or workflow. MCP after-read verifies these preserved; fixture updated timestamps may legitimately change when adding/removing its synthetic attachment.
- Guard logic must have offline assert-based refusal tests before Main Agent reviews and authorizes a live invocation. All unsafe route/method/identity/body/repeated POST/old DELETE cases must stop before network continuation.

## Role and model record

Test-QA Agent Sol/medium completed auxiliary requirements/contract inventory without execution, writes or credentials. Its checklist is NATIVE-ATTACHMENT-ACCEPTANCE-2026-10-25.md. Build-Audit Agent Astra/low is reused for a bounded test-only harness and offline guard checks; its prior bounded protocol audit was correct, but no measured comparable implementation cost exists. Main Agent reviews the security-sensitive network boundary before running it. No dependent phases overlap; Test-QA observes only the frozen harness after BUILD. Actual token usage unavailable; no savings claim.

SC-001 remains separately blocked pending JetBrains clarification; the support packet is prepared but unsent. Native attachment testing does not relax that gate.

Firefox first attempt stopped at launch with zero receipts/messages: the standalone wrapper omitted the repository launcher's PLAYWRIGHT_BROWSERS_PATH. A credential-free smoke reproduced missing default-cache executable; the existing .playwright-browsers/firefox-1555 installation is present. Main Agent applies the smallest configuration repair in its private wrapper, reusing scripts/playwright.mjs's established path. No app source or harness protocol changes; no separate Repair Agent is warranted for this one-line configuration. Preserve the initial stopped result. Verify credential-free launch, then one new bounded Firefox run. No cloud request or mutation occurred on the first attempt.
