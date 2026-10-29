"use client";
import type { AuthorizedProject } from "@/auth/identity";
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
  return (
    <>
      <section className="port-form" aria-label="YouTrack account">
        <h1>ROMDex</h1>
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
            <button
              disabled={busy}
              onClick={() => {
                void signIn();
              }}
            >
              {busy ? "Signing in…" : "Sign in with YouTrack"}
            </button>
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
        <div inert={busy}>
          <Romdex />
        </div>
      )}
      {identity && selected && selected.shortName !== "PMON" && !busy && (
        <main className="port-form">
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
    </>
  );
};
export default AuthGate;
