import { isOAuthOrigin, OAUTH_ORIGIN } from "@/auth/oauth";
import { useState, useSyncExternalStore } from "react";
const subscribe = () => {
  return () => {
    return undefined;
  };
};
const canonicalOrigin = () => {
  return isOAuthOrigin(window.location.origin);
};
const serverOrigin = () => {
  return false;
};
const AuthSignIn = ({
  busy,
  signIn,
}: {
  busy: boolean;
  signIn: (rememberDevice?: boolean) => Promise<void>;
}) => {
  const [rememberDevice, setRememberDevice] = useState(false);
  const canonical = useSyncExternalStore(
    subscribe,
    canonicalOrigin,
    serverOrigin,
  );
  if (!canonical)
    return (
      <>
        <a className="primary" href={OAUTH_ORIGIN + "/"}>
          Sign in with YouTrack at romdex.vercel.app
        </a>
        <p>
          This address does not start sign-in. Existing browser data here stays
          untouched and is not automatically transferred to the new address.
        </p>
      </>
    );
  const open = () => {
    void signIn(rememberDevice);
  };
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={rememberDevice}
          disabled={busy}
          onChange={(event) => {
            setRememberDevice(event.target.checked);
          }}
        />
        Keep me signed in on this device (30 days)
      </label>
      <p>
        Use this only on a device you trust. YouTrack may still ask you to sign
        in again.
      </p>
      <button className="primary" disabled={busy} onClick={open}>
        {busy ? "Signing in…" : "Sign in with YouTrack"}
      </button>
    </>
  );
};
export default AuthSignIn;
