import { isOAuthOrigin, OAUTH_ORIGIN } from "@/auth/oauth";
import { type ChangeEvent, useState, useSyncExternalStore } from "react";
import DevTokenSignIn from "./dev-token-sign-in";
import TokenSignIn from "./token-sign-in";
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
  signedIn = false,
}: {
  busy: boolean;
  signedIn?: boolean;
  signIn: (rememberDevice?: boolean) => Promise<void>;
}) => {
  const [rememberDevice, setRememberDevice] = useState(false);
  const canonical = useSyncExternalStore(
    subscribe,
    canonicalOrigin,
    serverOrigin,
  );
  const open = () => {
    void signIn(rememberDevice);
  };
  const handleRemember = (event: ChangeEvent<HTMLInputElement>) => {
    setRememberDevice(event.target.checked);
  };
  return (
    <>
      {process.env.NODE_ENV === "development" ? (
        <DevTokenSignIn busy={busy} />
      ) : null}
      <label>
        <input
          type="checkbox"
          checked={rememberDevice}
          disabled={busy}
          onChange={handleRemember}
        />
        Keep me signed in on this device (30 days)
      </label>
      <p>
        Use this only on a device you trust. YouTrack may still ask you to sign
        in again.
      </p>
      {canonical ? (
        <button className="primary" disabled={busy} onClick={open}>
          {busy
            ? "Signing in…"
            : signedIn
              ? "Sign in again with YouTrack"
              : "Sign in with YouTrack"}
        </button>
      ) : (
        <>
          <a className="primary" href={OAUTH_ORIGIN + "/"}>
            Sign in with YouTrack at romdex.vercel.app
          </a>
          <p>
            YouTrack sign-in runs only at that address. Existing browser data
            here stays untouched and is not transferred to it.
          </p>
        </>
      )}
      <TokenSignIn busy={busy} rememberDevice={rememberDevice} />
    </>
  );
};
export default AuthSignIn;
