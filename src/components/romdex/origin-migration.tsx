import { OAUTH_ORIGIN } from "@/auth/oauth";
import AuthShell from "./auth-shell";
const OriginMigration = () => {
  return (
    <AuthShell>
      <main className="auth-card suite-tray port-form">
        <h2>The new ROMDex address is ready</h2>
        <p>
          The approved browser-access setting was saved and verified. This
          temporary administrator action has been removed.
        </p>
        <a className="primary" href={OAUTH_ORIGIN + "/"}>
          Open ROMDex
        </a>
        <p>
          Existing browser-local data at the old address stays untouched.
          Desktop or browser-local drafts require a reviewed recovery export and
          import; they are not automatically transferred.
        </p>
      </main>
    </AuthShell>
  );
};
export default OriginMigration;
