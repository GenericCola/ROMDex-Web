# Filter expansion correction

Checklist:
- [x] Active filter: a visible matching parent can expand and collapse its matching descendants.
- [x] Expand All and Collapse All affect filtered rows.
- [x] Search combined with a filter respects visible-parent expansion.
- [x] Nonmatching ancestors remain hidden but do not conceal matching descendants.
- [x] Clearing filters retains expansion preferences; scope and full-tree status rules remain unchanged.
- [x] Existing Status/Priority/Complexity/Assignee, active fill and Clear All behavior remain verified.
- [x] Web/PWA and desktop corrected; desktop source-only backup and complete profile preservation verified.
- [x] Unit, rendered browser and desktop checks recorded separately from physical-device acceptance.

The previous implementation deliberately traversed every branch while filtering. Its tests asserted those rows but never clicked a filtered parent's expand/collapse control. The new unit regression fails against that original code before the repair.

## Behavior and verification

The correction stops traversal beneath a visible matching parent when it is collapsed. Hidden nonmatching ancestors are still traversed so a matching descendant can appear without showing a task with the wrong status. Expansion preferences are retained; clearing a filter does not silently expand everything. Search without a filter retains its existing behavior. Full-tree status calculation is unchanged.

Current checks: 133 application unit tests and 27 worker/backend tests pass, with typecheck and lint clean. The web/PWA production build passes (75 shell assets). The focused browser matrix passes 15 tests in 30.7 seconds across Chromium, Firefox, WebKit, Android Chromium and iPhone WebKit profiles. The new rendered scene uses the task table's actual row controls, verifies collapsed/expanded row counts and arrow states, clicks Expand All/Collapse All, repeats with search, checks hidden nonmatching ancestors, then clears filters and verifies retained expansion. Three tests pass against the exact installed desktop renderer, including the same expansion flow and the unfinished-draft refusal. All fixture cloud mutations remain empty.

The desktop update replaces only public/work-view.mjs. Its pre-install source and complete 132-file Data directory are backed up at C:/Users/mrgen/AppData/Local/ROMDexDesktop/Backups/filter-expansion-2026-10-23T19-24-51-268Z. Backup hashes match, and the complete profile is unchanged after installation. Private evidence is in artifacts/desktop-filter-expansion/installation.json. The existing core status and GitHub sync modules are untouched. No YouTrack administrator installation or cloud settings change is involved.

For a fresh copy of the original desktop baseline, install the initial task-filter patch first, then scripts/install-desktop-filter-expansion.mjs. Both installers refuse unexpected source hashes and a running app; the latter applies the one-file correction. Historical filter packages remain preserved.

Review: traced visible and hidden parents, scoped descendants, active filters plus search, full-tree rollups, expansion storage and Clear All, native row controls and guarded installation. No unresolved issue found in this fix. Browser device profiles are emulated; physical mobile/PWA hosting acceptance is not claimed. The full browser matrix passes 228 tests with two expected mobile desktop-layout skips in 7.7 minutes.
