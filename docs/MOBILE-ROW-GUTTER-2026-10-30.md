# Mobile Work Tray indentation

The user's Android screenshot showed root Epics far to the right of the Name
heading. At390CSSpx, a matching synthetic browser fixture reproduced root title
x119px versus cell x25px. This was not incorrect tree depth: the desktop48px
selection/drag gutter and sibling controls consumed94px before a depth-zero title.
The existing mobile rule reduced outer table padding but retained that gutter.

At widths up to550px only, the gutter is now28px with stacked28px drag and24px
visible selection targets. Toggle/status widths stay unchanged; hierarchy gaps
are2px and depth steps16px. Measured root/child/grandchild titles are95/111/127px,
versus119/140/161px before. Rows naturally grow to61px rather than shrinking the
drag target or removing selection. Desktop rules and hierarchy data are unchanged.
Draft/group gutters share the same width. Horizontal scrolling remains confined
to the existing table; the390px document does not overflow horizontally.

This is a CSS-only application change on published auth-fix97ef5f7, not heldv29
sync. No authentication, storage, data, icon, permission or delivery change.
Browser checks use synthetic tasks and block remote mutations. Actual physical
Android layout acceptance remains for the user; Android installation was already
confirmed working and is not reopened by this correction.
