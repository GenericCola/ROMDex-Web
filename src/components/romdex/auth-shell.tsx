import type { ReactNode } from "react";
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
          <div className="brand">
            <div className="lens" aria-hidden="true" />
            <h1>
              <span className="brand-title">ROMDex</span>
            </h1>
            <div className="lamps" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="eyebrow">Your YouTrack workspace</span>
        </header>
      )}
      {children}
    </div>
  );
};
export default AuthShell;
