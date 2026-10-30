import { use } from "react";
import { SessionRecoveryContext } from "./session-recovery-context";
const SessionNotice = () => {
  const recovering = use(SessionRecoveryContext);
  if (!recovering) return null;
  return (
    <p className="port-recovery" role="alert">
      Your YouTrack session expired. Remote access is disconnected. Apply this
      dialog’s changes to preserve them, or close it to discard unapplied edits.
      Then use Workspace tools to export recovery or retry local saving. Account
      switching remains blocked until saving succeeds.
    </p>
  );
};
export default SessionNotice;
