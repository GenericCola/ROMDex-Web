const ReviewGuidance = ({
  choice,
}: {
  choice: "check" | "keep" | "stop" | "rollup" | "create";
}) => {
  if (choice === "create")
    return (
      <p>
        Confirm by exact ID and matching task fields. Stopping creation archives
        dependent browser changes; a cloud task may already exist. Inspect
        YouTrack before creating again.
      </p>
    );
  if (choice === "rollup")
    return (
      <p>
        This is a calculated status; your assigned choice is kept. Confirm the
        result or keep the current YouTrack value. The next Save recalculates
        from fresh tasks.
      </p>
    );
  if (choice === "keep")
    return (
      <p>
        To keep your version, read the comparison above, then choose below. This
        reads the latest task and queues your edited fields for a later Save;
        those fields can replace the YouTrack values. No edit is sent now.
      </p>
    );
  if (choice === "stop")
    return (
      <p>
        To keep the YouTrack version instead, stop this entire pending change
        below. It stays in the recovery archive; this does not undo anything
        already sent.
      </p>
    );
  return (
    <p>
      First inspect this task in YouTrack. If the earlier change is already
      there, use “Check YouTrack; confirm without resending”. If it cannot be
      verified, leave it paused; do not create or upload it again.
    </p>
  );
};
export default ReviewGuidance;
