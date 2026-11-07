import type { ReactNode } from "react";
import DeviceBrand from "./device-brand";
const AuthShell = ({
  children,
  connected = false,
}: {
  children: ReactNode;
  connected?: boolean;
}) => {
  return (
    <div
      className={"romdex-app " + (connected ? "auth-connected" : "auth-shell")}
    >
      {!connected && (
        <header className="device-header" aria-label="Application Header">
          <DeviceBrand title="ROMDex" />
          <span className="eyebrow">Your YouTrack workspace</span>
        </header>
      )}
      {children}
    </div>
  );
};
export default AuthShell;
