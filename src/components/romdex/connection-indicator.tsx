import { tw } from "@utils/tw";
import { connectionIndicator } from "./indicator-status";
const ConnectionIndicator = ({
  connected,
  enabled,
  paused,
  open,
}: {
  connected: boolean;
  enabled: boolean;
  paused: boolean;
  open: () => void;
}) => {
  const indicator = connectionIndicator(connected, enabled, paused);
  return (
    <button
      id="connect-open"
      className="header-connection"
      aria-label={"Connection Details · " + indicator.label}
      title={indicator.label}
      onClick={open}
    >
      <span className="connection-status" role="status">
        <span className={tw("bulb", indicator.color)} aria-hidden="true" />
        <span className="sr-only">{indicator.label}</span>
      </span>
    </button>
  );
};
export default ConnectionIndicator;
