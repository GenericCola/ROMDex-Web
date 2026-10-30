# Automatic data connection and control spacing

User requested sign-in establish data connectivity without a separate delivery
opt-in. This batch starts from published `84c6126e`, not the held sync candidate.

Verified PMON selection and tab-session resume now connect the existing bounded
client automatically after fresh identity/project checks and scoped storage open.
Read-only projects do not acquire a writable client. Connection failure retains
valid sign-in and exposes Retry data connection inside Connection Details.
Original token storage/expiry and logout/account isolation are unchanged.

Existing Auto-Sync OFF is preserved. Only demonstrably new scoped workspaces
start ON. Unknown legacy/imported workspaces are not silently opted in. OFF stops
automatic dispatch, but manual Save and review retain a verified connection.
Any nonconfirmed journal entry, including a ready reviewed deletion, keeps the
connection paused until explicit Save. No uncertain outcome is blindly replayed.

The user-rejected notice above the trays is removed; its information remains in
Connection Details and existing Save/connection controls. Project chooser Cancel
has a 12px separate row gap. Related review, import, attachment-cache and RDX
confirmation labels have explicit checkbox gaps; connection review sections have
consistent spacing. No replacement toolbar or menu is introduced.

Acceptance uses synthetic identities/data with remote mutations forbidden. Real
Gobind refresh acceptance and physical Android acceptance remain user checks.
The earlier screenshot's deletion error was disconnected delivery, not a proven
YouTrack permission or baseline-comparison failure. No real task was deleted.

Filters positioning: actual compiled production CSS resets dialog margin to 0,
while the desktop CSS depended on the browser's native auto margin. Reproduced
at x=0,y=0 with production CSS, not just an isolated component fixture. Restore
margin:auto for desktop dialogs without changing their established layout.
