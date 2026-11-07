import { postTokenLogin } from "@/auth/token-login";
import CredentialForm from "./credential-form";
// Rendered only when NODE_ENV is "development", so production bundles drop it.
// The route exists only in `pnpm dev` (server/dev-token.ts).
const send = (code: string) => {
  return postTokenLogin(
    "/api/auth/dev-token",
    { code },
    "That code was not accepted. Copy it from the pnpm dev output.",
  );
};
const DevTokenSignIn = ({ busy }: { busy: boolean }) => {
  return (
    <CredentialForm
      busy={busy}
      label="Developer sign-in code"
      action="Sign in with the developer token"
      send={send}
    >
      <p>
        Development only. Signs in as the account behind YOUTRACK_TOKEN in .env.
        The code is printed in the pnpm dev output.
      </p>
    </CredentialForm>
  );
};
export default DevTokenSignIn;
