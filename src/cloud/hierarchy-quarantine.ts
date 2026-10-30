import { assertNotRecoveryMode } from "@/auth/recovery-mode";
import type { WorkspaceData } from "@/domain/types";
import { connectionNeedsManualSave } from "./connection-policy";
// Reopening must not resend unreviewed hierarchy changes from an earlier session.
export class HierarchyQuarantine {
  private ids = new Set<string>();
  assertConnectionAllowed() {
    assertNotRecoveryMode();
  }
  capture(data: WorkspaceData) {
    this.ids = new Set(
      data.operations
        .filter((op) => {
          return op.type === "edit" && Object.hasOwn(op.patch, "parentId");
        })
        .map((op) => {
          return op.issueId;
        }),
    );
    return this.blocked(data) || connectionNeedsManualSave(data);
  }
  message(data: WorkspaceData, suspended: boolean) {
    return this.blocked(data)
      ? "Earlier hierarchy changes quarantined. Export a recovery copy for review; Save and Auto-Sync cannot resend them."
      : suspended
        ? "Data connection ready. Reviewed changes remain paused until Save Changes."
        : "YouTrack data connected";
  }
  assertSafe(data: WorkspaceData) {
    assertNotRecoveryMode();
    if (this.blocked(data))
      throw Error(
        "Earlier hierarchy changes are quarantined. Do not retry Save. Export a recovery copy and review these moves before delivery; all local work is preserved.",
      );
  }
  blocked(data: WorkspaceData) {
    return data.operations.some((op) => {
      return (
        op.type === "edit" &&
        Object.hasOwn(op.patch, "parentId") &&
        this.ids.has(op.issueId)
      );
    });
  }
}
