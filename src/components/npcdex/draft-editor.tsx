import type { WorkspaceData } from "@/domain/types";
import type { NpcdexTarget } from "@/npcdex/model";
import { useNpcdexDraft } from "./use-npcdex-draft";
const DraftEditor = ({
  data,
  target,
}: {
  data: WorkspaceData;
  target: NpcdexTarget;
}) => {
  const { draft, dirty, busy, message, edit, submit, setDraft, setDirty } =
    useNpcdexDraft(data, target);
  return (
    <section aria-label="NPCDex proposed changes" className="npcdex-editor">
      <h3>Notes and proposed changes</h3>
      <p>
        Planning draft for content revision {draft.sourceRevision}. Editing this
        draft does not certify testing or publish a content change.
      </p>
      <label>
        Feedback note
        <textarea
          value={draft.note}
          disabled={busy}
          onChange={(event) => {
            edit("note", event.target.value);
          }}
        />
      </label>
      <label>
        Change intent
        <input
          value={draft.intent}
          disabled={busy}
          onChange={(event) => {
            edit("intent", event.target.value);
          }}
        />
      </label>
      <label>
        Implementation instructions
        <textarea
          value={draft.instructions}
          disabled={busy}
          onChange={(event) => {
            edit("instructions", event.target.value);
          }}
        />
      </label>
      <label>
        Proposed dialogue
        <textarea
          value={draft.proposedText}
          disabled={busy}
          onChange={(event) => {
            edit("proposedText", event.target.value);
          }}
        />
      </label>
      <label>
        Feedback flag
        <select
          value={draft.flag}
          disabled={busy}
          onChange={(event) => {
            const { value } = event.target;
            if (
              value === "none" ||
              value === "flagged" ||
              value === "critical"
            ) {
              setDraft({ ...draft, flag: value });
              setDirty(true);
            }
          }}
        >
          <option value="none">None</option>
          <option value="flagged">Flagged</option>
          <option value="critical">Critical</option>
        </select>
      </label>
      <button onClick={submit} disabled={!dirty || busy}>
        Save NPCDex Draft
      </button>
      <p role="status">
        {dirty ? "Unsaved NPCDex draft" : message || "No unsaved draft changes"}
      </p>
    </section>
  );
};
export default DraftEditor;
