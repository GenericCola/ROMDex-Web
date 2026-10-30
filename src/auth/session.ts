import { assertCookieHandle, isCookieHandle } from "./cookie-client";
let current: {
  token: string;
  expiresAt: number;
  userId: string;
  projectId: string;
} | null = null;
export const setAuthSession = (value: typeof current) => {
  current = value;
};
export const authToken = () => {
  if (!current || Date.now() >= current.expiresAt)
    throw Error("Sign in with YouTrack again.");
  return current.token;
};
export const authIdentity = () => {
  authToken();
  if (!current) throw Error("Sign in with YouTrack again.");
  return { userId: current.userId, projectId: current.projectId };
};
export const hasAuthSession = () => {
  return current !== null && Date.now() < current.expiresAt;
};
export const authRequestGuard = (token: string) => {
  const bound = current;
  return () => {
    if (isCookieHandle(token)) assertCookieHandle(token);
    if (
      bound &&
      (current !== bound ||
        current.token !== token ||
        Date.now() >= current.expiresAt)
    )
      throw Error(
        "The signed-in session changed. Review any pending cloud outcome before retrying.",
      );
  };
};

export const expired = (expiresAt: number) => {
  return Date.now() >= expiresAt;
};
