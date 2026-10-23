# Review this local build

Preview: http://localhost:3000

Use a separate browser profile or private window for the fictional examples below. These checks review the current checkpoint. They do not certify the full port or replace the desktop fallback. Leave delivery disconnected and Auto-Sync Off.

1. Open RDX Files and choose tests/fixtures/native-map.rdx from the web repository. Review its identity, acknowledge the recovery-copy statement and choose Open Map in NPCDex. This is a fictional map generated with the desktop packer, not production content.
2. Choose its map, area, encounter and dialogue point. Check text, images, gender/timeline controls, map navigation and scrolling. Enter a separate proposed dialogue draft. Save Changes, reload and confirm the draft remains while current dialogue stays unchanged.
3. Export Recovery Copy. In another separate test browser profile, import that recovery JSON, review its counts and acknowledge the replacement. Confirm the draft is present. Browser restore tests cover storage failure and stale-revision refusal; your visual/keyboard acceptance is still separate.
4. Open RDX Files and export the retained map. Confirm the downloaded filename and inspect the result if desired. Automated checks verify exact bytes, hashes and assets. No task plan is sent to PMON through this library.

The original desktop profile and installed client remain intact. Do not treat this checkpoint as an instruction to replay desktop queues, enable production sharing or discard the desktop.

The complete behavior and acceptance checklist is PORT-ACCEPTANCE.md. Known unfinished areas include task attachments/custom properties/multi-select, full NPCDex authoring and content synchronization, managed plan publication, live metadata acceptance and HTTPS/physical-device delivery.

For live acceptance, an administrator must upload and activate artifacts/romdex-status-acceptance-1.0.3.zip for NPCD only. It permits writes only to NPCD-872 and NPCD-873. Instructions and the checksum are in LIVE-ACCEPTANCE.md. A hosting account/root HTTPS address is still needed before deployed-origin and real-device acceptance.
