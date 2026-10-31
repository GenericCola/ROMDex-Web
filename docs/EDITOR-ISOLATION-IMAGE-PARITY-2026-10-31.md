# Editor isolation and tile-image parity

Actual desktop browser tests found that unapplied Tile Settings and unfinished Group parent titles blocked unrelated Auto-Sync. Both registrations lacked their known ticket scope. Clearing only the draft text resumed unrelated delivery while leaving the editor open.

Tile drafts now hold their own ticket. Group drafts hold the selected members and their existing parent. Automatic structural-delivery exclusions, group hierarchy-signature checks, review guards and explicit Apply/Finish/Cancel requirements are unchanged. Arbitrary Plan/NPCDex drafts remain unscoped. Scoped editors preserve their own incoming baseline while unrelated safe scalar work and incoming updates can continue.

The original desktop image chooser accepts up to 8 MiB and stores a PNG scaled to at most 192 pixels on its longest edge, without upscaling. The web chooser now follows that behavior instead of rejecting files above 2 MiB and retaining full-size originals. Existing PNG/JPEG/GIF/WebP restrictions and encoded 4096-pixel/8-megapixel bounds remain; decoded dimensions are also checked. Canvas preserves aspect and transparency, and bitmaps close even on drawing/encoding failure. Workspace image state changes only after successful normalization. Existing images are not rewritten automatically.

Tests cover per-ticket outgoing/incoming isolation, structural and reviewed-member rejection, explicit draft flush refusal, byte/dimension boundaries and failure cleanup. Actual desktop browser evidence separately covers image picker/preview/cancel/apply/remove/reopen, queued data preservation and original-size acceptance. No live user task writes or physical Windows installed-app test are claimed.
