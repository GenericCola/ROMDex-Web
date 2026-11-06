# YouTrack storage for ROMDex metadata and NPCDex

Design for PMON-570 (epic PMON-569). It moves the data in the private GitHub repo
GenericCola/ROMDex-Data into two private YouTrack articles, so ROMDex-Web is the
only repo and YouTrack the only backend. Steps 2 to 4 (PMON-571 to PMON-573)
build what this document describes.

Everything here was read on 2026-11-06 from ROMDex-Data `main`, the desktop
writer code in GenericCola/ROMDex, ROMDex-Web `main` (8284337) and YouTrack
with GET requests only. Nothing was written anywhere except this file.

## 1. What ROMDex-Data holds

All data sits under one workspace folder,
`workspaces/1e267c45-75ae-48a9-b173-5ca3132bb121/`. The tree has 431 files and
10.1 MB (the epic's count of 425 is a few commits old).

| Path                                    | Files | Bytes     | What it is                            |
| --------------------------------------- | ----- | --------- | ------------------------------------- |
| `README.md`                             | 1     | 112       | Repo note                             |
| `bootstrap.json`                        | 1     | 801       | Workspace identity and limits         |
| `npcdex/genesis.json`                   | 1     | 161       | Points at the NPCDex import record    |
| `npcdex/records/<sha256>.json`          | 1     | 2,665     | The NPCDex import record              |
| `npcdex/retired-provider.json`          | 1     | 643       | Says NPCDex moved to YouTrack         |
| `romdex-metadata/genesis.json`          | 1     | 160       | Points at the metadata genesis record |
| `romdex-metadata/records/<sha256>.json` | 203   | 179,073   | Genesis plus 202 metadata edits       |
| `objects/<2 hex>/<sha256>`              | 222   | 9,938,183 | Data chunks, 512 KiB max              |

The writer is `apps/romdex/cloud/github-store.mjs`. It only ever adds files: each
publish builds a new Git tree on the observed head and moves `main` without force.
A path that already exists must keep the same bytes. Records and objects are
named by the SHA-256 of their exact bytes, so the name is the integrity check.

### bootstrap.json

`ROMDexCloudBootstrap/1`. It pins the repo (GenericCola/ROMDex-Data, id
1421625633, branch `main`), the owner (GitHub 32021766, YouTrack 2-2), the two
namespaces `npcdex` and `romdex-metadata`, and the limits: 524,288-byte chunks,
262,144-byte records, 64 MiB expanded payloads. The desktop pins its SHA-256
(`e47be8ff…25c4`) and refuses to sync if it changes.

### Objects

`objects/<first two hex chars>/<sha256>` holds raw bytes, at most 512 KiB. An
object has no header and no type; the record that lists it says how to read it.
Metadata and NPCDex share the folder. Of the 222 objects, 202 belong to metadata
(23 KB in all, largest 744 bytes) and 20 to the NPCDex import (9.9 MB).

Compression depends on the record, not the object:

- Metadata edits and NPCDex change records gzip their JSON payload first, then
  split the gzip stream into 512 KiB pieces. Every metadata object starts with
  `1f 8b`.
- The NPCDex import stores the original file bytes uncompressed (`codec:
"raw-utf8"`). Its first object starts with `{"`.

To rebuild a blob, read the record's `chunks` list in order, fetch each object,
check its SHA-256 and length, concatenate, check the whole against the record's
`sha256` and `bytes`, then gunzip if the codec is `gzip` and check
`expandedSha256` and `expandedBytes`. Every chunk except the last is exactly
524,288 bytes in NPCDex records; metadata records do not enforce that.

### romdex-metadata

ROMDex metadata is a small document with one map per field, keyed by task:

```json
{
  "version": 1,
  "images": { "PMON-12": "data:image/png;base64,…" },
  "orders": { "PMON-16": ["PMON-65", "PMON-66"], "ROOT": ["PMON-1"] },
  "assigned": { "PMON-2": "In Development" }
}
```

Versions 2 to 5 add `authorizations`, `acceptances`, `reviews` and `testing`
(agent handoff and human testing history). `images` are tile images as data URLs
up to 2 MB. `orders` lists children of a parent in display order. `assigned` is a
parent's saved own status. (`metadata-core.mjs`)

Files:

- `genesis.json` is `{"format":"ROMDexMetadataRoot/1","workspace":…,"record":<id>}`.
- The genesis record (`ROMDexMetadataGenesis/1`) has no parents and the hash of
  the empty document.
- Every other record is a `ROMDexMetadataChange/1`:

```json
{
  "format": "ROMDexMetadataChange/1",
  "workspace": "1e267c45-…",
  "namespace": "romdex-metadata",
  "actor": "32021766",
  "device": "<uuid>",
  "sequence": 202,
  "operation": "<uuid>",
  "kind": "edit | merge | resolution",
  "parents": ["<record id>"],
  "base": "<record id>",
  "before": "<sha256 of canonical document before>",
  "after": "<sha256 of canonical document after>",
  "review": { "token": "…", "choice": "…", "heads": ["…"] },
  "payload": {
    "codec": "gzip",
    "sha256": "…",
    "bytes": 210,
    "expandedSha256": "…",
    "expandedBytes": 512,
    "chunks": [{ "sha256": "…", "bytes": 210 }]
  }
}
```

The payload is a gzip JSON list of changes, one per changed key:
`{field, key, before, after}`, with `after: null` for removal.

How records chain: a record's id is the SHA-256 of its bytes. `parents` lists
the heads it follows; `base` is the version its changes apply to (for an edit,
its single parent). To build a version, follow `base` back to the genesis, then
apply each payload forward, checking `before` and `after` hashes at every step.
The canonical hash is SHA-256 of `JSON.stringify` with the version's field list
and keys sorted. A head is a record no other record names as a parent. Two heads
mean two devices edited at once; the desktop then writes a `merge` record if no
key clashes, or holds a review until the user picks a version (`resolution`).

The live data is simple: 202 `edit` records from a single device, one straight
chain, one head (`d7da8645…`, sequence 202). I rebuilt every version and all 202
`after` hashes matched. The current document is 5,996 bytes: version 1, 54
sibling orders, 136 saved statuses and no images. The desktop app still appends
to this chain; the last commit is "Append ROMDex Metadata Changes" today.

### npcdex

The NPCDex document (`npcdex-current.json`) is the desktop save: version 2 JSON
with `towns`, `stages`, `annotations`, `changePlans`, `history` and about 30
other top-level fields. Images are embedded as data URLs.

Files:

- `genesis.json` is `{"format":"ROMDexNPCDexGenesis/1","workspace":…,"record":<id>}`.
- `records/90af156c….json` is the only record, a `ROMDexNPCDexImport/1` made on
  2026-10-16. It lists two documents, each with `name`, `sha256`, `bytes`,
  `codec: "raw-utf8"` and `chunks`:
  - `npcdex-current.json`: 9,915,298 bytes in 19 objects, SHA-256 `2c50ee40…630c`,
    revision 73, 4 towns, 448 dialogue blocks, 159 embedded images.
  - `npcdex-recovery-draft.json`: 4 bytes, the literal `null`.
- `retired-provider.json` (`ROMDexRetiredNPCDexProvider/1`, 2026-10-18) records
  that NPCDex authority moved to YouTrack project NPCD, keeps this folder as
  recovery only, and pins the accepted source `2c50ee40…` and head `90af156c…`.

The desktop's change format (`ROMDexNPCDexChange/1` and `/2`, gzip JSON patch
lists chained like metadata records) exists in `npcdex-change.mjs`, but no change
record was ever published. NPCDex in ROMDex-Data is one frozen snapshot.

I rebuilt `npcdex-current.json` from its 19 chunks; the SHA-256 matched, and
`JSON.stringify(JSON.parse(file))` gives back the exact bytes, so a parsed copy
can be checked byte for byte.

### Where NPCDex lives today

The desktop reads NPCDex from YouTrack, not GitHub. `cloud/desktop-provider.mjs`
opens the content provider (`content/desktop-provider.mjs`) first and only falls
back to GitHub when no content provider is configured. The content provider reads
and writes `NPCDexCarrier/1` publications as attachments on a registry issue in
NPCD, through `content/youtrack-reader.mjs` and `youtrack-writer.mjs`.

The registry named in `retired-provider.json` (3-376) no longer exists. The
current one is NPCD-660 (3-1020), created 2026-10-22 by a "reconnect" import:
74 attachments, 16.3 MB, two publications, last changed 2026-10-22 14:45 UTC.
Its first publication names the same source file `2c50ee40…`. Nothing has been
published since, so the snapshot in ROMDex-Data still holds the current NPCDex
content. NPCD-660 and the 212 `[NPCDex]` issues stay untouched as recovery.

ROMDex-Web does not read either source. It gets NPCDex only from a desktop
export file (`npcdex-current.json` inside the export made by
`scripts/export-desktop.mjs`).

## 2. What ROMDex-Web already has

### Browser state today

All workspace state is one `WorkspaceData` object (`src/domain/types.ts`) in
IndexedDB database `romdex-web-workspace`, store `workspace`, one record per
YouTrack instance, user and project (`src/storage/workspace-storage.ts`,
`workspace-key.ts`). Saves are revision-checked so two windows cannot overwrite
each other.

| Data                | Field in `WorkspaceData`                    | Matches                                   |
| ------------------- | ------------------------------------------- | ----------------------------------------- |
| Tile images         | `images: Record<PMON-N, dataURL>`           | metadata `images`                         |
| Sibling order       | `order: Record<PMON-N, number>` (positions) | metadata `orders` (parent to ordered ids) |
| Saved parent status | `remote[].assignedState`                    | metadata `assigned`                       |
| NPCDex content      | `npcdex` (the whole v2 document)            | `npcdex-current.json`                     |
| NPCDex drafts       | `npcdexDrafts`, `npcdexHistory`             | nothing in ROMDex-Data                    |

The web keeps order as positions and the desktop as lists, so sync must convert
both ways. The desktop's `captureMetadata` and `projectOrder` in
`metadata-core.mjs` do exactly this and can be ported next to
`src/domain/accepted/core.mjs` (which already has `indexTree`).

Assigned status also has a second home: the romdex-status YouTrack app
(`docs/SHARED-STATUS.md`). Production sharing through that app is still off.

The web has no fields for `authorizations`, `acceptances`, `reviews` or
`testing`. They are empty in the live data, so nothing is lost today.

NPCDex in the web is read-only content plus local drafts
(`src/npcdex/model.ts`). Content editing is not ported yet.

### Modules the new store reuses

- **YouTrack requests**: `sessionRequest` and `list` in
  `src/youtrack/request.ts`. They handle both token and cookie sign-in, timeouts
  and 404s.
- **Attachment bytes**: `attachmentBytes` in `src/youtrack/attachment-bytes.ts`
  downloads with a size cap and an approved-URL check. It needs an article
  variant: the current one and the cookie proxy route `/api/attachment` take a
  PMON issue id.
- **Attachment upload**: `AttachmentClient.upload` in
  `src/youtrack/attachment-client.ts` posts one multipart `upload` field. Its
  routes are hard-wired to `issues/PMON-N`; the store needs the same calls on
  `articles/<id>/attachments`.
- **Hashing and base64**: `sha256`, `base64Bytes` and `encodeBytes` in
  `src/domain/bytes.ts` (WebCrypto).
- **IndexedDB**: the open/transaction pattern in `src/storage/workspace-storage.ts`
  and `upload-storage.ts`. The store adds its own database for its cache (below).
- **Upload-size message**: `requireUploadSize` already refuses more than
  4,000,000 bytes in cookie mode with a clear message.

The cookie proxy (`server/`, `docs/COOKIE-SERVER-INTEGRATION.md`) only allows
listed PMON issue routes and has no NPCD writes. Step 2 must add the article
routes for the two articles, or the store works only with token sign-in.

## 3. Target design

### Articles

| Title       | Project    | Holds                     |
| ----------- | ---------- | ------------------------- |
| ROMDex data | PMON (0-1) | ROMDex metadata           |
| NPCDex data | NPCD (0-2) | NPCDex content and drafts |

Both use `LimitedVisibility` for thegobindsingh (2-1) and GenericCola (2-2). The
size probe article TST-A-1 already uses this visibility.

The body is a short note, then the manifest in a fenced `json` block, like Track
Suru's settings article (`mytrack/src/lib/suru/app-settings.ts`):

> ROMDex keeps its synced data here. Only thegobindsingh and GenericCola can see
> this article. Change the data in ROMDex; edits made here are overwritten.

### Manifest

```json
{
  "format": "romdex-store",
  "version": 1,
  "store": "romdex-metadata",
  "revision": 7,
  "writtenAt": "2026-11-07T10:00:00.000Z",
  "writtenBy": "2-1",
  "writeId": "<uuid>",
  "files": {
    "assigned": {
      "name": "assigned--3f1c9a0e5b7d2c41.json.gz",
      "sha256": "<sha256 of the stored bytes>",
      "size": 1834,
      "where": "youtrack",
      "id": "<attachment id>",
      "codec": "gzip-json"
    },
    "image/PMON-12": {
      "name": "image--9b2e…16 hex….png",
      "sha256": "…",
      "size": 48211,
      "where": "youtrack",
      "id": "…",
      "codec": "raw",
      "type": "image/png"
    }
  },
  "source": {
    "repo": "GenericCola/ROMDex-Data",
    "commit": "<git sha>",
    "head": "<record id>",
    "sha256": "<source document or canonical hash>"
  }
}
```

- `format` and `version` identify the schema. A reader refuses a higher
  `version` and says to update the app; it never writes over it.
- `store` is `romdex-metadata` or `npcdex`, so the wrong article is never used.
- `revision` goes up by one on every write. `writeId` lets a writer confirm that
  the body it reads back is its own.
- `files` maps a part key to one stored file. Each entry has the fields from the
  epic, `{name, sha256, size, where: "youtrack", id}`, plus `codec` (`gzip-json`
  or `raw`) and `type` for images. `sha256` and `size` describe the bytes as
  stored, so a download is checked before it is unzipped.
- `source` is set by the migration and kept unchanged after.

`where` has one value for now, `youtrack`. A reader that meets another value
treats that part as unavailable and does not write the article.

### Parts and attachment names

A part is the unit stored as one attachment. Merging is per key inside a part,
so parts can be coarse.

ROMDex data:

| Part key                                              | Content                                   |
| ----------------------------------------------------- | ----------------------------------------- |
| `orders`                                              | metadata `orders` map                     |
| `assigned`                                            | metadata `assigned` map                   |
| `image/<PMON-N>`                                      | one tile image, decoded to its file bytes |
| `authorizations`, `acceptances`, `reviews`, `testing` | each map, only when not empty             |

NPCDex data:

| Part key         | Content                                                |
| ---------------- | ------------------------------------------------------ |
| `town/<town id>` | one entry of `towns`, images replaced by references    |
| `annotations`    | `annotations` map                                      |
| `plans`          | `changePlans` map                                      |
| `history`        | `history` list (append-only, entries have unique `id`) |
| `root`           | every other top-level field                            |
| `drafts`         | the web's `npcdexDrafts` and `npcdexHistory`           |
| `image/<sha256>` | one distinct image, decoded to its file bytes          |

NPCDex images appear 159 times but only 39 are distinct (541 KB in all, largest
76 KB). Each string `data:image/<type>;base64,…` in the document is replaced by
`{"$image": "<sha256 of decoded bytes>", "type": "image/png"}` and stored once.
Rebuilding puts the same data URL back. With images out, the rest of the document
is 5.9 MB of JSON and 0.95 MB gzipped; the largest part (`history`) is 670 KB
gzipped.

Attachment names are `<part key with / as -->--<first 16 hex of sha256>.<ext>`,
for example `town--new-bark-town--4be1…16 hex….json.gz` or
`image--9b2e…16 hex….png`. The hash in the name makes each upload a new file, so
an upload never replaces a file another device still lists. A writer that finds
an existing attachment with the same name, size and SHA-256 reuses its id
instead of uploading again.

Old attachments stay on the article after the manifest moves on. Nothing
deletes them, and the owner decided there will be no automatic cleanup.

### Finding the article

1. Use the article id cached in this browser for this instance, user and store.
   Read it with `articles/<id>?fields=id,summary,content,updated,project(id)`.
   Accept it if the title, project and manifest `store` match.
2. Otherwise search `articles?query={ROMDex data}` (or `{NPCDex data}`) and keep
   exact title matches in the right project with a readable manifest for this
   store.
3. One match: cache its id. More than one: show their ids and stop syncing until
   the owner picks one. Never pick one silently, because two stores would split
   the data.
4. None: the browser shows "Not set up" and keeps working locally. It creates the
   article only after the user confirms (owner decision), with `POST articles` and
   `{project: {id}, summary, content, visibility: {$type: "LimitedVisibility",
permittedUsers: [{id: "2-1"}, {id: "2-2"}]}}`. Normally the migration
   creates both articles.

### Sync

Per-key merge follows Track Suru's settings sync
(`components/settings-sync/sync.ts`), with an `updated` check before each write.

The browser keeps a store cache in its own IndexedDB database
(`romdex-web-store`):

- `base`: for each store, the manifest revision and the merged values from the
  last successful sync. This is the merge base.
- `blobs`: downloaded part bytes keyed by SHA-256, so unchanged parts are not
  downloaded again.
- `pending`: whether local changes wait for upload.

One sync:

1. Read the article: `content` and `updated`. Parse the manifest.
2. Download each part whose SHA-256 is not in `blobs`. Check size and SHA-256,
   then unzip.
3. Merge each key three ways:
   - local equals base: take remote;
   - remote equals base: take local;
   - local equals remote: take it;
   - otherwise it is a conflict (below).

   A key missing on one side counts as removed there. A browser with no base
   (first sync) takes remote for every key YouTrack has and keeps its own value
   only for keys YouTrack lacks. A fresh device therefore cannot wipe another
   device's data.

4. Build the new parts, gzip them (`CompressionStream`), hash them, and refuse
   any over the limit (below).
5. Upload only parts whose SHA-256 changed.
6. Read the article again. If its manifest (`writeId` and `revision`) changed
   since step 1, start over from step 1 (at most three times, then report
   "Another device is saving. Try again."). The implementation compares the
   manifest, not `updated`: every attachment upload moves the article's
   `updated`, including our own from step 5.
7. Write the body with the new manifest, `revision + 1` and a new `writeId`.
8. Read the body back. If it carries another `writeId`, a second device wrote
   just after us and replaced our manifest; start over. Our changes are still
   local, so the next merge adds them on top of the other device's, and our
   uploads are reused by name. If the other device wrote just before us, our
   write replaced its manifest, and that device's own read-back catches it the
   same way.
9. Save the merged values as the new base and apply them to `WorkspaceData`.

Steps 6 to 8 narrow the race but cannot close it, because YouTrack has no
conditional write for articles. Two devices writing in the same second can still
clash; step 8 catches the common case. The existing delivery code has the same
limit.

Merge keys:

- ROMDex data: `<field>/<key>`, for example `assigned/PMON-2`,
  `orders/PMON-16`, `image/PMON-12`.
- NPCDex data: `town/<id>`, `annotations/<key>`, `plans/<key>`, `history/<id>`, `root/<top-level field>`, `drafts/<target key>`. `history` entries are
  never edited, so the merge is a union by `id`, sorted by `timestamp`.

### Conflicts

When both sides changed the same key to different values since the base:

- The remote value stays in the article. The local value is not written.
- The key goes into a review list in the browser, with both values and the time
  of the remote write. The app shows a "Needs review" state with Keep mine and
  Keep YouTrack's for each key.
- The local value is also kept in the workspace recovery history, so a wrong
  choice or a reload loses nothing.
- Other keys sync normally.

`orders` needs care: two devices that reorder different children of the same
parent change the same key. That is a conflict, the same as on the desktop.

### The 4 MB limit

A part over 4,000,000 bytes after gzip is refused before upload, with:

> "<name>" is 5.2 MB. ROMDex can store files up to 4 MB in YouTrack for now.
> Nothing was uploaded; your copy stays in this browser.

4,000,000 bytes matches the cookie proxy's upload cap. YouTrack itself accepts
10 MiB. The other parts still sync; the refused part stays pending and the store
shows it. Today nothing comes close: the largest part is 670 KB, and desktop tile
images are capped at 2 MB.

### Offline

Edits save to IndexedDB as they do now and mark the store pending. Nothing is
sent while offline. The store retries on the browser's `online` event, on Save
Changes and on a timer. The status shows "Saved in this browser; waiting to
sync". A failed sync changes nothing in YouTrack before step 7, and uploads
without a manifest write are harmless extra files.

## Implementation (PMON-571, PMON-572)

Code lives in `src/store/`:

| Folder              | What                                                                                                                                | Imports                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `src/store/parts`   | Manifest, codecs, SHA-256, attachment names, the 4 MB refusal, ROMDex and NPCDex part split and rebuild                              | Pure; plain Node 24 can import `index.ts`    |
| `src/store/core`    | Find and create the article, list and upload attachments, `readStore`, `commitStore` (steps 4 to 8), `tokenTransport` for scripts    | Transport injected; Node 24 can import it    |
| `src/store/merge`   | Per-key three-way merge, merge keys for both stores, web positions to desktop lists and back                                         | Browser                                      |
| `src/store/browser` | IndexedDB cache `romdex-web-store`, workspace bindings, the sync runner, review, status and the controller started by the app shell | Browser                                      |

The UI is one notice line under the save feedback (only when a store needs
review or holds a refused part) and a "YouTrack data sync" section in
Connection Details: a status per store, Sync now, "Set up in YouTrack…" with a
confirmation, a choice between several matching articles, and the review list
with Keep mine and Keep YouTrack's.

Where the build differs from the plan above:

- **Change check.** Step 6 compares the manifest, not `updated` (see above).
- **Reuse.** An attachment with the same name and size is reused only after its
  bytes are downloaded and compared.
- **Unchanged parts.** A part whose decoded content equals YouTrack's keeps its
  manifest entry; nothing is re-encoded, so gzip output differences between
  browsers never cause uploads.
- **Conflicts.** The browser shows YouTrack's value at once. Its own value goes
  to the review list and to an append-only `recovery` store in
  `romdex-web-store` (not the workspace recovery export). Keep mine writes it
  back into the workspace and the next sync sends it.
- **Keys this browser cannot apply now** (orders while a create, delete or move
  waits for delivery, a status for a task not read yet, or a key edited while
  the sync ran) keep the old base, so a later sync applies them or reports a
  conflict.
- **First sync.** With no base, nothing is carried from YouTrack into the local
  side, so YouTrack's values are applied; keys only this browser has are sent.
- **Orders.** A local list that keeps the base list's relative order keeps the
  base list, including ids this browser does not know. Otherwise ids it does
  not know are appended after the captured list.
- **4 MB.** A refused part keeps its previous stored version. All local changes
  of that sync stay pending, and the status repeats the refusal. An NPCDex image
  over 4 MB is not split out: it stays inline, so the town or field that holds
  it is refused whole and no stored part points at a missing image. A town or
  field part that was never stored is left out of the rebuilt document.
- **Assigned status.** The whole `assigned` part is handled in
  `src/store/browser/assigned.ts`. `ASSIGNED_IN_STORE = false` turns it off:
  the browser then passes YouTrack's `assigned` part through untouched and
  writes nothing to tasks. It is also off while romdex-status sharing is on
  (`cloud.sharedStatuses`).
- **Cookie proxy.** `server/article-policy.ts` allows reads of articles, and
  writes only to "ROMDex data" in PMON and "NPCDex data" in NPCD: create with
  exactly the LimitedVisibility for 2-1 and 2-2, content updates up to 1 MB of
  text, and uploads. `/api/attachment` takes `article=` as well as `issue=`.
  `AttachmentClient` stays issue-only; article attachments go through
  `src/store/core/attachments.ts`, and `attachmentBytes` accepts an article
  target.
- **When it syncs.** On app start, five seconds after the workspace changes,
  when the browser comes online, every five minutes, and on Sync now. Syncs run
  one at a time, and across tabs through Web Locks. Offline, the status says
  "Saved in this browser; waiting to sync."

## 4. Migration (PMON-573)

`scripts/migrate-youtrack-storage.mjs`, run with Node 24 from the repo. It reads
ROMDex-Data through the GitHub API (GET only) and writes only the two articles.

Flags: `--dry-run` (default, no writes), `--write`, `--target test` (project TST,
titles "ROMDex data (test)" and "NPCDex data (test)") for PMON-574.

Steps:

1. Read the `main` head commit and its full tree; refuse a truncated tree.
   Record the commit.
2. Check `bootstrap.json` against SHA-256 `e47be8ff…25c4` and the workspace id.
3. Metadata: read `genesis.json`, all records and their objects. Check every
   record and object against its name. Check the chain: one genesis, every
   parent present, no cycles. Rebuild every version and check each `after` hash.
   Require exactly one head; with more, stop and say to open the desktop app so
   it merges them.
4. NPCDex: read `genesis.json`, the import record and `retired-provider.json`.
   Rebuild `npcdex-current.json` from its chunks, check `2c50ee40…` and
   9,915,298 bytes, and check the record's `summary` against the parsed file.
   The recovery draft is `null` and is reported, not stored.
5. Build the parts and manifests as in section 3, with `source` filled in.
   Convert nothing else: metadata keeps the desktop's field shapes, NPCDex keeps
   the v2 document.
6. Find each article by title and project.
   - Missing: create it (in `--write`).
   - Present with the same `source.commit` and all hashes verified: report
     "already migrated" and stop for that store.
   - Present with other content: stop and show the difference. The script does
     not merge into a live store.
7. Upload each part unless an attachment with the same name, size and SHA-256
   is already there. Then write the manifest.
8. Verify from YouTrack only: read the article again, list its attachments,
   download every part through its signed URL, check every size and SHA-256,
   rebuild both documents, and compare them to the source: the metadata
   canonical hash must equal the head's `after`, and the rebuilt NPCDex bytes
   must hash to `2c50ee40…`.
9. Read the ROMDex-Data head again. If it moved, report that the desktop wrote
   during the run and that the run must be repeated after the desktop is quit.
10. Print a receipt (commit, article ids, attachment ids, hashes, byte counts) to
    stdout or a path outside the repo.

Re-running is safe: lookups are by title and content hash, uploads are reused by
name, and the script never deletes or overwrites a store it did not just verify.
A run stopped halfway leaves extra attachments and no manifest, or a manifest
whose parts all verify.

The dry run does steps 1 to 6 and prints what it would create or upload, with
sizes and any part over 4 MB.

The browser's own drafts (`npcdexDrafts`, `npcdexHistory`) are not in ROMDex-Data.
Each browser merges them on its first sync.

Expected size: ROMDex data is two parts of a few KB (no images today). NPCDex
data is about 45 attachments: 4 towns, `annotations`, `plans`, `history`, `root`
and 39 images, about 1.5 MB in all.

### The migration as built

`scripts/migrate-youtrack-storage.mjs` with its modules in `scripts/migration/`
(`github-source`, `romdex-data`, `parts` over `src/store/parts`, `plan`, and
`write` over `src/store/core`). It differs from the steps above in these ways:

- **Both stores are checked before anything is written.** If either article
  holds other content, the run stops (exit 5) and creates, uploads and changes
  nothing, not even for the other store.
- **"Already migrated"** means the manifest's `source` has the same repo, head
  and hash, the parts are the planned ones, and the parts downloaded from
  YouTrack rebuild to the source hash. A different `source.commit` alone does
  not count as different; the receipt shows it.
- **An article with the right title but no usable manifest** stops the run
  rather than getting a second article next to it.
- **The production guard.** `--write --target production` is refused without
  `--i-have-quit-the-desktop-app`. `--target test` writes to TST (0-4) with
  titles ending "(migration test, safe to delete)". `--test-label <label>` makes
  a separate pair.
- **Exit codes:** 0 written or already migrated, 2 usage, 3 a part over 4 MB,
  4 ROMDex-Data moved during the run, 5 other content, 1 any other error.
- **Credentials.** The write needs `YOUTRACK_URL` and `YOUTRACK_TOKEN`; GitHub
  uses `GITHUB_TOKEN` or `gh auth token`. The receipt and the download cache
  must be outside the repository.

## 5. Rollback

ROMDex-Data, the desktop app and NPCD-660 are not changed by any step. Going back
means reopening the desktop app and ignoring the articles. Edits made in the web
after cutover exist only in the articles; to carry them back, export them from
the web (recovery export) and re-enter them on the desktop. The articles can be
archived or left in place; nothing reads them unless the web app does.

Until cutover (PMON-574) the desktop keeps appending metadata to ROMDex-Data.
Migrate only after the desktop is quit for good, or the articles fall behind.

## 6. Open questions for the owner

1. **NPCDex source.** The epic calls NPCD-660 retired, but the desktop app still
   treats it as the live NPCDex store, and ROMDex-Data's NPCDex folder is the
   frozen snapshot it was built from (same source hash, no edits since
   2026-10-22). The plan is to migrate NPCDex from the ROMDex-Data snapshot.
   Please confirm the desktop has no unsynced NPCDex edits, or say whether the
   source should be a fresh desktop export instead.
2. **Assigned status.** Still open: the "ROMDex data" article or the
   romdex-status app. It is built as the article part `assigned` behind one
   switch (see Implementation), so it can be dropped without touching the rest.
3. **Old attachments.** Decided: kept, never cleaned up automatically.
4. **Article creation.** Decided: only the migration creates articles without
   asking; a browser asks first.

## 7. Revised estimate

The formats fit the plan, with two changes: NPCDex is one 9.9 MB document that
must be split into parts (it is not 512 KB pieces of data the app can use as is),
and the cookie proxy needs article routes.

| Step                  | Was      | Now      | Why                                                                                                 |
| --------------------- | -------- | -------- | --------------------------------------------------------------------------------------------------- |
| PMON-571 store module | 3 to 4 h | 4 to 6 h | Article routes in the cookie proxy and attachment client, gzip, the read-back check                 |
| PMON-572 wire sync    | 3 to 5 h | 5 to 7 h | Order list to position conversion, NPCDex part split and rebuild, image references, conflict review |
| PMON-573 migration    | 2 to 3 h | 3 to 4 h | Chain check and rebuild of 202 metadata versions, NPCDex reassembly and byte-exact check            |

Total for steps 2 to 4: 12 to 17 hours, up from 8 to 12.
