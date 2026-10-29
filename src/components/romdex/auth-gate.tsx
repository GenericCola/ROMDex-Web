"use client";
import type { AuthorizedProject } from "@/auth/identity";
import AuthShell from "./auth-shell";
import AuthSignIn from "./auth-sign-in";
import Romdex from "./index";
import { exportRecovery } from "./recovery-export";
import { useAuthWorkspace } from "./use-auth-workspace";
const AuthGate = () => {
  const {
    identity,
    selected,
    issues,
    busy,
    message,
    choose,
    signIn,
    signOut,
    recoveryBlocked,
    finishExpired,
  } = useAuthWorkspace();
  const renderProject = (project: AuthorizedProject) => {
    const open = () => {
      void choose(project);
    };
    return (
      <button key={project.id} disabled={busy} onClick={open}>
        {project.name} ({project.shortName})
      </button>
    );
  };
  const connected = !!identity && selected?.shortName === "PMON";
  return (
    <AuthShell connected={connected}>
      <section
        className={
          connected
            ? "auth-account-bar port-form"
            : "auth-card suite-tray port-form"
        }
        aria-label="YouTrack account"
      >
        {!connected && (
          <div>
            <span className="eyebrow">Connection</span>
            <h2>{identity ? "Choose your project" : "Sign in to ROMDex"}</h2>
          </div>
        )}
        {identity ? (
          <>
            <p>
              Signed in as {identity.name} ·{" "}
              {selected?.name ?? "Choose a project"}
            </p>
            <div className="port-actions">
              {identity.projects.map(renderProject)}
              <button
                disabled={busy}
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </button>
            </div>
            {!identity.projects.length && (
              <p>YouTrack returned no accessible projects.</p>
            )}
          </>
        ) : (
          <>
            <p>
              Sign in with YouTrack to see the projects your account can access.
              Your password stays with YouTrack.
            </p>
            <AuthSignIn busy={busy} signIn={signIn} />
          </>
        )}
        <p role="status">{message}</p>
        {recoveryBlocked && (
          <div className="port-actions">
            <button
              onClick={() => {
                void finishExpired();
              }}
            >
              Retry local saving
            </button>
            <button onClick={exportRecovery}>Export Recovery Copy</button>
          </div>
        )}
      </section>
      {identity && selected?.shortName === "PMON" && (
        <div className="auth-workspace" inert={busy}>
          <Romdex />
        </div>
      )}
      {identity && selected && selected.shortName !== "PMON" && !busy && (
        <main className="auth-project suite-tray port-form">
          <h2>{selected.name}</h2>
          <p>
            Read-only project view. Editing is unavailable until this project's
            field and status rules are verified.
          </p>
          {issues.map((issue) => {
            return (
              <article key={issue.id}>
                <h3>
                  {issue.idReadable} · {issue.summary}
                </h3>
                <p className="whitespace-pre-wrap">{issue.description}</p>
              </article>
            );
          })}
        </main>
      )}
    </AuthShell>
  );
};
export default AuthGate;
