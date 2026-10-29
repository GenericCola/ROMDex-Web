"use client";
import { allowedCallback } from "@/auth/oauth";
import AuthShell from "@/components/romdex/auth-shell";
import { useEffect } from "react";
const Callback = () => {
  const complete = () => {
    const url = window.location.href;
    const callback = window.location.origin + "/oauth/callback/";
    window.history.replaceState(null, "", "/oauth/callback/");
    const opener = window.opener as Window | null;
    if (opener && allowedCallback(callback))
      opener.postMessage({ type: "romdex-oauth", url }, window.location.origin);
  };
  useEffect(complete, []);
  return (
    <AuthShell>
      <main className="auth-card suite-tray port-form">
        <h1>Returning to ROMDex</h1>
        <p>
          You can close this window. If sign-in did not finish, start again from
          ROMDex.
        </p>
      </main>
    </AuthShell>
  );
};
export default Callback;
