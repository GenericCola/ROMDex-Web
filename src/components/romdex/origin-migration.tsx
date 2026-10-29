"use client";
import { LEGACY_ORIGIN, OAUTH_ORIGIN } from "@/auth/oauth";
import AuthShell from "./auth-shell";
import { useOriginMigration } from "./use-origin-migration";
const OriginMigration = () => {
  const {
    busy,
    preview,
    identity,
    message,
    confirmed,
    setConfirmed,
    dispatched,
    legacy,
    login,
    inspect,
    apply,
  } = useOriginMigration();
  return (
    <AuthShell>
      <main className="auth-card suite-tray port-form">
        <h2>Allow the new ROMDex address</h2>
        <p>
          Temporary administrator migration. Adds only {OAUTH_ORIGIN} to
          YouTrack browser access. Existing permissions and origins stay
          unchanged. No task data is changed.
        </p>
        {!legacy ? (
          <a className="primary" href={LEGACY_ORIGIN + "/origin-migration/"}>
            Open the existing address to review
          </a>
        ) : (
          <>
            {!identity && (
              <button className="primary" disabled={busy} onClick={login}>
                Sign in with YouTrack to review
              </button>
            )}
            {identity && (
              <>
                <p>
                  Signed in as {identity}. YouTrack must permit Low-level Admin
                  Write.
                </p>
                <button disabled={busy} onClick={inspect}>
                  Read current allowed origins
                </button>
              </>
            )}
            {preview && (
              <>
                <h3>Existing allowed origins</h3>
                <ul>
                  {preview.baseline.map((origin) => {
                    return <li key={origin}>{origin}</li>;
                  })}
                </ul>
                <p>
                  {preview.needed
                    ? "Proposed addition: " + OAUTH_ORIGIN
                    : "The new address is already allowed."}{" "}
                  Allow all origins stays off.
                </p>
                {preview.needed && !dispatched && (
                  <>
                    <label>
                      <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={busy}
                        onChange={(event) => {
                          setConfirmed(event.currentTarget.checked);
                        }}
                      />{" "}
                      I approve this exact additive change.
                    </label>
                    <button
                      className="primary"
                      disabled={busy || !confirmed}
                      onClick={apply}
                    >
                      Save this allowed origin
                    </button>
                  </>
                )}
                {!preview.needed && (
                  <a className="primary" href={OAUTH_ORIGIN + "/"}>
                    Open ROMDex at its new address
                  </a>
                )}
              </>
            )}
          </>
        )}
        <p role="status">{busy ? "Working…" : message}</p>
        <p>
          Avoid concurrent administrator changes to this origin list while
          applying. YouTrack does not offer an atomic compare-and-set for this
          setting.
        </p>
        <p>
          The setting is saved permanently by YouTrack. This page never stores
          or displays your token. Close it when verification is complete.
        </p>
      </main>
    </AuthShell>
  );
};
export default OriginMigration;
