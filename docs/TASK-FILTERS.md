# Task filters

The filter button sits next to Search in the task toolbar. Its three-row slider icon fills light green while any filter is active. Filters apply immediately; Close or Escape dismisses the popup and restores focus to the launcher.

Status uses the displayed effective status, including inherited parent rollups and the Needs Testing/Awaiting Testing alias. Hidden tasks still contribute to rollups. Only matching rows appear: a nonmatching ancestor is not inserted as context, and collapsed ancestors cannot conceal a matching descendant. Priority, Complexity and Assignee combine with Status using AND. Complexity includes Not Set; Assignee includes Unassigned. Assignees use stable user IDs, including multi-user fields. Desktop Priority labels retain LOW/NORMAL/HIGH/URGENT presentation.

Search and project scope intersect filters. An explicit Status overrides Hide Completed, so choosing Done can show completed rows. Clear All sits at the bottom right and resets the four popup fields while preserving search, scope and Hide Completed. Filters are local view choices; reopening the Work Tray or restarting the app resets them. Existing browser snapshots need a fresh task read or reviewed desktop import to populate Assignee metadata. Filtering never creates a cloud operation or changes task properties.

## Requirement evidence

| Requirement | Verification |
| --- | --- |
| Slider graphic in the existing button row; matching controls and popup style | Desktop and iPhone screenshots visually inspected; focused test passes in Chromium, Firefox, WebKit, Android Chromium and iPhone WebKit profiles. |
| Status shows only matching rows | Browser and installed-desktop renderer tests assert exact rows; domain regression checks inherited parents and the testing alias. |
| Hidden ancestors and collapse do not conceal matching children | Browser test starts collapsed; domain test intersects project scope. |
| Other fields narrow together | Browser tests select all four fields and assert one exact row; real reader path imports single/multi-user synthetic Assignees and switches identities. Desktop renderer selects a named Assignee with Priority and Complexity. |
| Clear All at bottom right; normal fill when cleared | Relative button positions, all-field reset and pressed state asserted through native controls. Search preservation verified. |
| Light-green active fill | Exact computed RGB 129,199,154 asserted in web and desktop. |
| Empty matches, completion controls, keyboard and focus | Empty-result text and explicit Done over Hide Completed tested; Escape closes and launcher focus restored across all five profiles. First browser run exposed a focus defect; repaired before installation. |
| Tasks, notes and connection remain intact | Filter predicate leaves task data unchanged. Desktop synthetic UI records zero issue mutations. Installer compares complete profile and backup hashes and preserves existing core/sync sources. |
| Desktop delivery | Five-file source update installed after the user confirmed exit; complete 132-file Data backup verified; profile unchanged. Exact installed files pass two synthetic renderer tests, including the unfinished-draft refusal message. |
| Web/PWA delivery | Filter-only production build passes with 76 shell assets. Focused filter matrix: 10/10 pass. Full worktree matrix: 223 pass, two expected mobile desktop-layout skips, 7.4 minutes. |

## Verification limits and delivery

Local full-worktree check: 132 application unit tests and 27 worker/backend tests pass, with types and lint clean. The worktree also contains pre-existing unfinished attachment work; it is excluded from the filter commit. The separate staged-source check passes 124 application unit tests, 27 worker/backend tests, types and lint, with no dependency on that unfinished work. Its production build also passes.

Focused browser matrix: 10 pass in 18.2 seconds. Desktop renderer: candidate passes; exact installed source passes both the main flow and unfinished-draft refusal. The tracked patch reproduces all five installed files byte for byte from the source backup. Screenshots are synthetic-only in ignored artifacts. Browser device profiles are emulation; physical mobile/PWA hosting acceptance is not claimed.

Desktop backup: C:/Users/mrgen/AppData/Local/ROMDexDesktop/Backups/task-filters-2026-10-23T19-11-42-662Z. Evidence is in artifacts/desktop-task-filters/installation.json. Installed app source is preserved in that backup alongside the complete Data directory. The installer verifies source baseline hashes, prepares the patch separately, refuses a running app, verifies the full backup and every installed source hash, and rolls source back if installation fails. It never writes profile data.

No YouTrack app ZIP, administrator installation, PMON change, CORS setting, production sharing or hosted deployment is involved. Web changes are delivered through the private port repository and local web/PWA build. Existing public hosting remains unconfigured.

Official field reference: [YouTrack custom fields and user values](https://www.jetbrains.com/help/youtrack/devportal/api-howto-get-issues-with-all-values.html).

Review: traced both full-tree visibility paths, parent rollups, Assignee import/readback and delivery allowlists, local view state, modal lifecycle, active CSS specificity, desktop editor flush and source-only installation. No unresolved filter defect found. Full worktree browser regression: 223 passed, two expected mobile desktop-layout skips, in 7.4 minutes. The independent checkpoint check and build pass.

Independent filter-only PWA browser acceptance also passes all 10 checks across the five profiles in 19.0 seconds. This uses the staged checkpoint build, excluding unfinished attachment work.
