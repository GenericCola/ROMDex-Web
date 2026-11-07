import { flushLocal } from "@/auth/flush-local";
import { postTokenLogin } from "@/auth/token-login";
import { errorText } from "@utils/error-text";
import { useState } from "react";

// Rendered only when NODE_ENV is "development", so production bundles drop it.
// The route exists only in `pnpm dev` (server/dev-token.ts).
const DevTokenSignIn = ({ busy }: { busy: boolean }) => {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const signIn = async () => {
    setPending(true);
    setMessage("");
    try {
      await flushLocal();
      await postTokenLogin(
        "/api/auth/dev-token",
        {},
        "The developer token was not accepted. Check YOUTRACK_TOKEN in .env.",
      );
    } catch (error) {
      setMessage(errorText(error, "Sign-in failed."));
      setPending(false);
    }
  };
  const handleSignIn = () => {
    void signIn();
  };
  return (
    <>
      <p>
        Development only. Signs in as the account behind YOUTRACK_TOKEN in .env.
      </p>
      <button
        className="primary"
        disabled={busy || pending}
        onClick={handleSignIn}
      >
        {pending ? "Signing in…" : "Sign in with the developer token"}
      </button>
      {message && <p role="alert">{message}</p>}
    </>
  );
};
export default DevTokenSignIn;
