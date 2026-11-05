import { reviewTickets } from "@/cloud/review-isolation";
import { deliveryPaused } from "@/cloud/session";
import type { WorkspaceSnapshot } from "@/domain/types";
const SaveFeedback = ({
  state,
  review,
}: {
  state: WorkspaceSnapshot;
  review: () => void;
}) => {
  const held = reviewTickets(state.data);
  const paused = deliveryPaused() || !!state.error;
  return (
    <div className="port-notice" role="status" aria-live="polite">
      {state.delivering
        ? "Syncing changes with YouTrack. Additional work saves in this browser."
        : (paused || !held.size) && state.connection}
      {!state.delivering && held.size > 0 && (
        <span>
          {" "}
          {held.size} task{held.size === 1 ? "" : "s"} awaiting confirmation or
          review. {!paused && "Other unrelated changes can sync."}{" "}
          <button onClick={review}>Review saved changes</button>
        </span>
      )}
    </div>
  );
};
export default SaveFeedback;
