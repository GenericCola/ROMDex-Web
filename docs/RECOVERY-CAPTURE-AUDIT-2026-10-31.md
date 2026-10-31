# Recovery capture audit

## Identity and compatibility

Recovery evidence now has a unique `captureId`, separate from a producer's task or document `id`. Repeated exports append evidence without replacing an earlier draft or colliding when the same tile is edited again. Import validates identity uniqueness; recognized historical item, tile, group-parent and plan captures receive deterministic collision-safe identities. Unknown or malformed no-identity records still fail validation.

Capture/export never flushes editors or creates queued operations. Reopening recovery evidence does not replay edits, confirm conflicts, resend attachments or approve deletion. Existing typed task values, queued operations and workspace drafts retain their normal serialization.

## Producer coverage

- Item editor: native/custom/tag identities, checked state, all selected options and original typed task values.
- Tile settings: task identity plus old/current name and image evidence.
- Group parent: selected IDs, intended parent and unsaved title.
- RDX plan: stable model keys distinguish duplicate labels, mappings, deletion checkboxes and local task controls. Labels remain readable context, not identity.
- NPCDex draft: its existing semantic record remains unchanged; capture identity is additive.
- Notes, inline titles, comments and new tasks already persist in workspace fields/operations, rather than separate editor captures.
- Attachment metadata and bytes use their existing scoped recovery paths. In-flight chooser/hash work and transient conflict acknowledgments are not replayable recovery commands.

File/password input contents are excluded from generic control capture. Capture history retains the existing import validation bound; no history is silently truncated.

## Verification boundaries

Focused tests cover all capture producers, repeated exports, UUID collisions, legacy normalization, malformed records, serialization and reopen without replay. Actual desktop Chromium fixtures cover typed item-editor and plan controls, production scoped IndexedDB and synthetic transport. These checks do not claim a physical Windows installed-app test or live user ticket writes.
