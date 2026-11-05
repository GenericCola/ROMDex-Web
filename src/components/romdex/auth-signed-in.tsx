import type { AuthorizedProject, YouTrackIdentity } from "@/auth/identity";
import AuthSignIn from "./auth-sign-in";
const AuthSignedIn = ({
  identity,
  selected,
  disabled,
  choose,
  signIn,
  signOut,
}: {
  identity: YouTrackIdentity;
  selected: AuthorizedProject | null;
  disabled: boolean;
  choose: (project: AuthorizedProject) => Promise<void>;
  signIn: (rememberDevice?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}) => {
  const renderProject = (project: AuthorizedProject) => {
    const open = () => {
      void choose(project);
    };
    return (
      <button key={project.id} disabled={disabled} onClick={open}>
        {project.name} ({project.shortName})
      </button>
    );
  };
  const logout = () => {
    void signOut();
  };
  return (
    <>
      <p>
        Signed in as {identity.name} · {selected?.name ?? "Choose a project"}
      </p>
      <div className="port-actions">
        {selected?.shortName !== "PMON" && identity.projects.map(renderProject)}
        <button disabled={disabled} onClick={logout}>
          Sign out
        </button>
      </div>
      <details>
        <summary>Keep this device signed in</summary>
        <p>
          To request 30-day sign-in on this device, select the option below and
          sign in again with YouTrack. Your current sign-in stays unchanged
          until you press the button.
        </p>
        <AuthSignIn busy={disabled} signIn={signIn} signedIn />
      </details>
      {!identity.projects.length && (
        <p>YouTrack returned no accessible projects.</p>
      )}
    </>
  );
};
export default AuthSignedIn;
