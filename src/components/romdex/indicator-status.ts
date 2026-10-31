// Desktop sync-control parity: off is dark blue, healthy blue, unavailable red.
export const connectionIndicator = (
  connected: boolean,
  enabled: boolean,
  paused: boolean,
) => {
  if (!enabled) return { color: "dark-blue", label: "Auto-Sync Data Is Off" };
  if (!connected) return { color: "red", label: "Connect to YouTrack" };
  if (paused)
    return {
      color: "red",
      label: "YouTrack Delivery Is Paused — Open Connection Details",
    };
  return { color: "blue", label: "YouTrack Connection Is Healthy" };
};

export const completedControl = (hidden: boolean) => {
  return {
    label: hidden ? "Show Completed" : "Hide Completed",
    color: hidden ? "red" : "grey",
    title: hidden
      ? "Completed Items Are Hidden"
      : "Completed Items Are Visible",
  };
};
