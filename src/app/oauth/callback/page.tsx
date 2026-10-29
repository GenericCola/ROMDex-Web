"use client";
import { OAUTH_CALLBACK } from "@/auth/oauth";
import { useEffect } from "react";
const Callback = () => {
  const complete = () => {
    const url = window.location.href;
    window.history.replaceState(null, "", new URL(OAUTH_CALLBACK).pathname);
    const opener = window.opener as Window | null;
    if (opener && window.location.origin === new URL(OAUTH_CALLBACK).origin)
      opener.postMessage(
        { type: "romdex-oauth", url },
        new URL(OAUTH_CALLBACK).origin,
      );
  };
  useEffect(complete, []);
  return (
    <main className="p-6">
      <h1>Returning to ROMDex</h1>
      <p>
        You can close this window. If sign-in did not finish, start again from
        ROMDex.
      </p>
    </main>
  );
};
export default Callback;
