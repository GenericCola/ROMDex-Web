import { YouTrackHttpError } from "@/youtrack/http-error";
const stages = {
  revision: "checking for changed tickets",
  tasks: "reading the current tickets",
  apply: "updating this browser’s saved copy",
};
export class IncomingSuperseded extends Error {}
export class IncomingFailure extends Error {
  constructor(
    readonly stage: keyof typeof stages,
    readonly reason: unknown,
  ) {
    super(
      reason instanceof Error
        ? reason.message
        : "Incoming refresh failed while " + stages[stage],
    );
  }
}
export const incomingStep = async <T>(
  stage: keyof typeof stages,
  action: () => Promise<T>,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    if (error instanceof IncomingSuperseded) throw error;
    throw new IncomingFailure(stage, error);
  }
};
const explanations = new Map([
  [
    "A native State value is unreadable. Status rollups were stopped.",
    "A ticket has no readable YouTrack State.",
  ],
  [
    "Incoming hierarchy has an unreadable parent. Nothing was applied.",
    "A ticket’s parent is missing or not readable.",
  ],
  [
    "A circular parent relationship was found.",
    "The ticket hierarchy contains a circular parent relationship.",
  ],
  [
    "The hierarchy contains an unreachable cycle.",
    "The ticket hierarchy contains a circular parent relationship.",
  ],
  [
    "An incoming refresh tried to change local work. Nothing was applied.",
    "The saved local work changed during this read; it was not overwritten.",
  ],
]);
export const incomingFailureMessage = (error: unknown) => {
  const failure = error instanceof IncomingFailure ? error : null;
  const reason = failure?.reason ?? error;
  const prefix = failure
    ? `Incoming updates stopped while ${stages[failure.stage]}. `
    : "Incoming updates could not finish. ";
  let detail =
    "The returned data could not be safely used. Keep this message for support.";
  if (reason instanceof YouTrackHttpError) {
    detail =
      reason.status === 401
        ? "Your sign-in needs renewing before updates can be read."
        : reason.status === 403
          ? "YouTrack access was refused. Check Connection Details and your project access."
          : `YouTrack returned HTTP ${reason.status}. The request will be retried automatically.`;
  } else if (reason instanceof Error) {
    detail =
      explanations.get(reason.message) ??
      (reason.name === "TimeoutError" || reason.name === "AbortError"
        ? "The read timed out; it will be retried automatically."
        : reason instanceof TypeError
          ? "The connection or response could not be read; check your connection."
          : detail);
  }
  return (
    prefix + detail + " Your pending edits are kept; this read sent no changes."
  );
};
