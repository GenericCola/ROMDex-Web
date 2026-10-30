# Project selection from Tray 1

Local candidate based on live 3b85bcf. The user selected the project name at the
top of Tray 1 as the project-switch entry point. The existing heading is now a
native keyboard button opening the existing authorized-project choices in a
standard dialog. The signed-in gear no longer contains project buttons. Other
gear functions remain accessible while their eventual placement is undecided.

Cancel, Escape, and selecting the current project close the chooser without
switching or reconnecting. Other choices reuse the existing auth workspace flow:
flush local drafts/work, disconnect delivery, verify current identity/project
permission, then open the account/project-scoped workspace. No remote writes or
automatic delivery enablement are introduced. Failed permission checks do not
open the denied project's tasks. Non-PMON projects retain their existing
read-only screen and project selection; this does not add schema/write support.
NPCDex users return to ROMDex's Tray 1 to choose a YouTrack project.

Validation: 314 unit tests pass, including heading semantics, conflict queue and
comment draft preservation across workspace switch/back, and permission denial
before issue reads. Existing auth resume/cancellation/isolation tests pass.
Local Chrome rendered fixture verified Enter and Space activation, Cancel focus
return, current-project no-op, another project's callback, and an unchanged
queued-conflict indicator. The rendered fixture uses synthetic account/project
choices and rejects network mutations; it is not live project-switch or physical
Android acceptance. Independent source review found no blocker.

No publication authorized for this local candidate yet. No update action was
added to the rejected gear, and no replacement home was invented for its other
functions.
