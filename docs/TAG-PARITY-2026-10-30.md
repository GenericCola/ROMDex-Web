# Original Tags editor restoration

The original desktop Edit Item tag checkboxes now load available existing tags
and a complete, paginated membership baseline. This restores an original control;
it does not add a global tag creator or a new tagging interface.

A fresh inventory updates cached remote metadata without overwriting pending tag
selections or their original conflict baseline. New choices must be present in
the available-tag response. Existing IDs can be retained when their labels are
unavailable. A missing baseline is not treated as an empty set.

Reviewed delivery uses per-issue add/remove endpoints, not replacement of the
whole tag collection. Each individual step is durably recorded before dispatch,
checks the complete visible membership set again immediately before sending, and
requires exact readback afterward. A partial or ambiguous attempt stays held.
Explicit fresh readback/rebase archives the original operation and step evidence
under its original ID before creating a new reviewed operation. It never infers
that an ambiguous request was not sent. These client checks are not server-side
atomic concurrency guarantees; production sharing remains disabled.

Create receipts are retained before parent/tag follow-up edits, so interrupted
follow-ups cannot recreate the task. RDX tag publication remains separately gated
until its baseline mapping and review path are integrated.

## Verification

The isolated adapter/editor candidate passed 282 unit tests, TypeScript, and
ESLint before merging. In the managed browser fixture, the original editor showed
an existing checked tag and an available unchecked tag. Saving a changed local
selection queued one edit; reopening against a fresh unchanged native inventory
preserved the pending selection. The fixture rejects every non-GET network call.
No real task/tag mutation was used for acceptance. Canonical aggregate checks are
recorded separately with the complete candidate receipt.

Official endpoint contracts:
- https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues-issueID-tags.html
- https://www.jetbrains.com/help/youtrack/devportal/api-usecase-add-remove-tags.html
- https://www.jetbrains.com/help/youtrack/devportal/resource-api-tags.html
