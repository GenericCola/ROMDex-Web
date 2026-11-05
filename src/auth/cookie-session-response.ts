import type { YouTrackIdentity } from "./identity";

export const parseCookieSession = (input: unknown) => {
  const value = input as {
    userId?: unknown;
    projects?: unknown;
    csrf?: unknown;
    expiresAt?: unknown;
    rememberDeviceRequested?: unknown;
    remembered?: unknown;
  };
  if (
    typeof value.userId !== "string" ||
    !value.userId ||
    !Array.isArray(value.projects) ||
    typeof value.csrf !== "string" ||
    typeof value.expiresAt !== "number" ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt * 1000 <= Date.now()
  )
    throw Error("Invalid server sign-in response.");
  const projects = value.projects as YouTrackIdentity["projects"];
  if (
    projects.some((p) => {
      return (
        !p ||
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        typeof p.shortName !== "string"
      );
    })
  )
    throw Error("Invalid authorized project list.");
  return {
    csrf: value.csrf,
    expiresAt: value.expiresAt * 1000,
    identity: { id: value.userId, name: value.userId, projects },
    notice:
      value.rememberDeviceRequested === true && value.remembered === false
        ? "YouTrack did not allow this device to stay signed in. This session will expire normally."
        : "",
  };
};
