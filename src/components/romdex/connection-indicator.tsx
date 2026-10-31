import { tw } from "@utils/tw";
import { connectionIndicator } from "./indicator-status";
const ConnectionIndicator = ({
  connected,
  enabled,
  paused,
  open,
  detail = "",
}: {
  connected: boolean;
  enabled: boolean;
  paused: boolean;
  open: () => void;
  detail?: string;
}) => {
  const indicator = connectionIndicator(connected, enabled, paused);
  const label = detail || indicator.label;
  return (
    <button
      id="connect-open"
      className="header-connection"
      aria-label={"Connection Details · " + label}
      title={label}
      onClick={open}
    >
      <span className="connection-status" role="status">
        <span className={tw("bulb", indicator.color)} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>
    </button>
  );
};
export default ConnectionIndicator;
