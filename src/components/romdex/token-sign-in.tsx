import { startTokenLogin } from "@/auth/token-login";
import CredentialForm from "./credential-form";
const TokenSignIn = ({
  busy,
  rememberDevice,
}: {
  busy: boolean;
  rememberDevice: boolean;
}) => {
  const send = (token: string) => {
    return startTokenLogin(token, rememberDevice);
  };
  return (
    <CredentialForm
      busy={busy}
      label="YouTrack permanent token"
      action="Sign in with a permanent token"
      secret
      send={send}
    >
      <p>
        Create one in YouTrack: your avatar, Profile, Account Security, Tokens,
        with the YouTrack scope. It keeps your full access until you revoke it
        there, so sign out here and revoke it when you are done with this
        device.
      </p>
    </CredentialForm>
  );
};
export default TokenSignIn;
