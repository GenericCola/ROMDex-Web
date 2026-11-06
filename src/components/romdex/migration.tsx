import Dialog from "./dialog";
import Pending from "./pending";
import { useMigration } from "./use-migration";
const Migration = ({ close }: { close: () => void }) => {
  const {
    preview,
    recovery,
    uploads,
    missingUploads,
    choices,
    confirmed,
    busy,
    message,
    select,
    toggle,
    submit,
    choose,
  } = useMigration(close);
  return (
    <Dialog title="Import Desktop or Recovery Data" close={close}>
      <p>
        Choose a verified desktop export or a ROMDex Web recovery copy. Files
        are read in this browser. Credentials are excluded from desktop exports.
        Delivery disconnects and Auto-Sync stays off after import.
      </p>
      <label>
        Export or recovery JSON
        <input
          type="file"
          accept=".json,application/json"
          onChange={select}
          disabled={busy}
        />
      </label>
      <Pending
        active={busy}
        label={
          (preview ?? recovery)
            ? "Importing reviewed data…"
            : "Reading and verifying the file…"
        }
        message={message}
      />
      {preview && (
        <>
          <p>
            {preview.remote.length} tasks · {preview.towns} NPCDex maps ·{" "}
            {preview.pending.length} desktop pending actions retained for
            review.
          </p>
          <p>
            The original export and previous browser workspace are retained in
            recovery. Desktop pending actions are preserved separately and will
            not be sent automatically.
          </p>
          {preview.choices.some((choice) => {
            return choice.conflict;
          }) && (
            <table aria-label="Desktop assigned-status conflicts">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Browser</th>
                  <th>Desktop</th>
                  <th>Use desktop choice</th>
                </tr>
              </thead>
              <tbody>
                {preview.choices
                  .filter((choice) => {
                    return choice.conflict;
                  })
                  .map((choice) => {
                    return (
                      <tr key={choice.id}>
                        <td>{choice.id}</td>
                        <td>{choice.browser}</td>
                        <td>{choice.desktop}</td>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={
                              "Use desktop assigned status for " + choice.id
                            }
                            checked={choices.includes(choice.id)}
                            onChange={(event) => {
                              choose(choice.id, event.target.checked);
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </>
      )}
      {!!missingUploads && (
        <p role="alert">
          {missingUploads} queued files need their original bytes restored. They
          cannot be delivered without verified bytes.
        </p>
      )}
      {recovery && (
        <p>
          Restore {recovery.remote.length} tasks and{" "}
          {recovery.operations.length} queued operations and {uploads.length}{" "}
          verified staged files from the web recovery file. Uncertain requests
          retain their review requirements. Export the current browser workspace
          before replacing it.
        </p>
      )}
      {(preview ?? recovery) && (
        <>
          <label className="port-check-line">
            <input type="checkbox" checked={confirmed} onChange={toggle} />I
            have preserved my current recovery copy and reviewed these import
            choices.
          </label>
          <button
            className="primary"
            onClick={submit}
            disabled={busy || !confirmed}
          >
            Import Reviewed Data
          </button>
        </>
      )}
    </Dialog>
  );
};
export default Migration;
