# Linked Issues desktop parity

The original desktop Work row shows a noninteractive `♧ N` badge titled “Linked Issues” for non-Subtask relationships. The web row now uses the same existing styling and occurrence-count semantics: occurrences across link groups are summed, not deduplicated into unique tasks. No relationship editor or write capability is added.

The common native read projection requests `links(linkType(name),issues(id))`, not `trimmedIssues`. Missing or unclassifiable metadata remains unknown; verified empty lists yield zero, and zero/unknown badges are hidden. Malformed lists and invalid stored numeric counts fail validation rather than becoming a false zero. Valid desktop migration counts remain available.

Equal-revision incoming reads may fill only a previously absent count. Existing focus, queued-operation, hierarchy and observed-revision fences apply first. No title, status, comments, assigned receipt or operation baseline is replaced by this metadata hydration, and it creates no outgoing operation or parent-status work. Newer revisions use the ordinary guarded refresh path. Counts are excluded from writable TaskPatch/native payload fields.

Verification includes mixed directions/Subtask exclusions, original duplicate occurrence semantics, 150 linked issues, migration/recovery validation, malformed inputs, outgoing-field rejection, equal-revision hydration and held-ticket preservation. Actual browser evidence is recorded separately. No live issue/link mutations are used.
