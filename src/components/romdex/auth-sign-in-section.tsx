import AuthSignIn from "./auth-sign-in";
const AuthSignInSection = ({
  busy,
  retryable,
  retryResume,
  signIn,
}: {
  busy: boolean;
  retryable: boolean;
  retryResume: () => unknown;
  signIn: (rememberDevice?: boolean) => Promise<void>;
}) => {
  return (
    <>
      <p>
        Sign in with YouTrack to see the projects your account can access. Your
        password stays with YouTrack.
      </p>
      {retryable && (
        <button
          disabled={busy}
          onClick={() => {
            retryResume();
          }}
        >
          Retry sign-in verification
        </button>
      )}
      <AuthSignIn busy={busy} signIn={signIn} />
    </>
  );
};
export default AuthSignInSection;
