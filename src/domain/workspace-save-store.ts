import { verifyRetainedAssets } from "@/migration/verify-assets";
import { errorText } from "@utils/error-text";
import { shareStructure } from "./share-structure";
import { WorkspacePersistenceStore } from "./workspace-persistence-store";
/** Recovering from a failed save and from another window's newer save. */
export class WorkspaceSaveStore extends WorkspacePersistenceStore {
  /** The revision this window last loaded or saved. */
  savedRevision = () => {
    return this.revision;
  };
  /**
   * Takes a newer saved workspace from another window when this one has no
   * unsaved changes, so its next edit does not fail as "saved first".
   */
  adoptNewer = async (idle: () => boolean) => {
    const calm = () => {
      const { ready, error, updating, delivering, pendingWrites } = this.state;
      return (
        !this.switching &&
        ready &&
        !error &&
        !updating &&
        !delivering &&
        !pendingWrites &&
        idle()
      );
    };
    if (!calm()) return false;
    const { generation, revision } = this,
      before = this.state.data;
    const record = await this.storage.load();
    if (!record || record.revision <= revision) return false;
    await verifyRetainedAssets(record.data);
    if (
      !calm() ||
      generation !== this.generation ||
      revision !== this.revision ||
      before !== this.state.data
    )
      return false;
    this.revision = record.revision;
    this.publish({ data: shareStructure(before, record.data) });
    return true;
  };
  retryLocalSave = () => {
    if (
      !this.state.ready ||
      !this.state.error ||
      this.state.updating ||
      this.state.delivering ||
      this.state.pendingWrites > 0
    )
      return Promise.reject(Error("No loaded workspace needs a save retry."));
    const retry = async () => {
      try {
        // Retain the original CAS revision. A conflict must never be resolved
        // by loading a newer revision and overwriting another window's work.
        this.revision = await this.storage.save(this.state.data, this.revision);
        this.publish({ error: "" });
      } catch (error) {
        this.publish({
          error: errorText(error, "Local saving failed."),
        });
        throw error;
      } finally {
        this.publish({ pendingWrites: this.state.pendingWrites - 1 });
      }
    };
    this.publish({ pendingWrites: this.state.pendingWrites + 1 });
    return this.saves.after(retry);
  };
}
