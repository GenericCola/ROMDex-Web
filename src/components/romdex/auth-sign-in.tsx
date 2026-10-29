import { isOAuthOrigin, OAUTH_ORIGIN } from "@/auth/oauth";
import { useSyncExternalStore } from "react";
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
  signIn: () => Promise<void>;
}) => {
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
    void signIn();
  };
  return (
    <button className="primary" disabled={busy} onClick={open}>
      {busy ? "Signing in…" : "Sign in with YouTrack"}
    </button>
  );
};
export default AuthSignIn;
