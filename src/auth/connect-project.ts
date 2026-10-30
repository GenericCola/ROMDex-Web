import { connectDelivery, disconnectDelivery } from "@/cloud/session";
import { YouTrackHttpError } from "@/youtrack/http-error";
import type { AuthorizedProject } from "./identity";
import { ResumeRejected } from "./resume-failure";
import { authIdentity, setAuthSession } from "./session";
import { forgetSession } from "./tab-session";
// Only verified PMON workspaces have a writable schema. Queue guards still apply.
export const connectProject = async (
  token: string,
  project: AuthorizedProject,
  assertCurrent: () => void,
  connect = (value: string) => {
    return connectDelivery(value, authIdentity().userId);
  },
) => {
  assertCurrent();
  if (project.shortName !== "PMON") return "";
  try {
    await connect(token);
    assertCurrent();
    return "";
  } catch (error) {
    assertCurrent();
    if (
      error instanceof ResumeRejected ||
      (error instanceof YouTrackHttpError && [401, 403].includes(error.status))
    ) {
      disconnectDelivery();
      setAuthSession(null);
      try {
        forgetSession();
      } catch {
        // Storage failure must not restore revoked memory access.
      }
      throw new ResumeRejected(
        "YouTrack access changed. Sign in again; local work is preserved.",
      );
    }
    return (
      "Signed in, but data connection could not be established. Retry in Connection Details. " +
      (error instanceof Error ? error.message : "Connection unavailable.")
    );
  }
};
