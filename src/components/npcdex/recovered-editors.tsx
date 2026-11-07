import type { WorkspaceData } from "@/domain/types";
import { workspaceStore } from "@/domain/workspace-store";
import { nodeText, saveNpcdexDraft } from "@/npcdex/model";
import { recoveredDraft } from "@/npcdex/recovered-draft";
import { errorText } from "@utils/error-text";
import { useState } from "react";
const RecoveredEditors = ({ data }: { data: WorkspaceData }) => {
  const [message, setMessage] = useState("");
  if (!data.editorRecovery?.length) return null;
  const restore = async (index: number) => {
    try {
      await workspaceStore.change((next) => {
        const record = next.editorRecovery?.[index];
        if (!record) throw Error("Recovery entry is missing.");
        const draft = recoveredDraft(record);
        if (!draft)
          throw Error("This editor needs a different recovery workflow.");
        saveNpcdexDraft(next, {
          ...draft,
          updatedAt: new Date().toISOString(),
        });
        record.reviewed = true;
      });
      await workspaceStore.flush();
      setMessage("Recovered draft saved. Current content is unchanged.");
    } catch (error) {
      setMessage(errorText(error, "Recovery needs review."));
    }
  };
  return (
    <details>
      <summary>
        Recovered unsaved editors ({data.editorRecovery.length})
      </summary>
      <p>
        Review before restoring. A changed content revision blocks restoration;
        retain the recovery copy to reconcile it.
      </p>
      {data.editorRecovery.map((record, index) => {
        return (
          <div key={nodeText(record, "captureId") || nodeText(record, "id")}>
            <pre className="port-detail-text">
              {JSON.stringify(record, null, 2)}
            </pre>
            <button
              disabled={record.reviewed === true}
              onClick={() => {
                void restore(index);
              }}
            >
              Restore Recovered Draft {index + 1}
            </button>
          </div>
        );
      })}
      <p role="status">{message}</p>
    </details>
  );
};
export default RecoveredEditors;
