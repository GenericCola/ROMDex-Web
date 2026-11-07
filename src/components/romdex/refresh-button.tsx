import { requestRefresh } from "@/cloud/refresh-request";
/**
 * Reads YouTrack again now. ROMDex never re-reads on a timer; it checks when
 * the window comes back into view, comes online, after a save, and here.
 */
const RefreshButton = ({ connected }: { connected: boolean }) => {
  const refresh = () => {
    requestRefresh();
  };
  return (
    <button
      className="auto-sync-toggle"
      onClick={refresh}
      disabled={!connected}
      title="Read the latest tasks and ROMDex data from YouTrack now"
    >
      Refresh
    </button>
  );
};
export default RefreshButton;
