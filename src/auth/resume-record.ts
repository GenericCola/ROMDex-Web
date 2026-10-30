import { YOUTRACK_ORIGIN } from "@/youtrack/read-tasks";
export const RESUME_KEY = "romdex.oauth.tab-session.v1";
export interface ResumeRecord {
  version: 1;
  instance: typeof YOUTRACK_ORIGIN;
  token: string;
  expiresAt: number;
  userId: string;
  projectId: string | null;
}
export type ResumeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const identifier = (value: unknown): value is string => {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
};
export const validResumeRecord = (
  input: unknown,
  now = Date.now(),
): input is ResumeRecord => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  return (
    value.version === 1 &&
    value.instance === YOUTRACK_ORIGIN &&
    typeof value.token === "string" &&
    value.token.length > 0 &&
    value.token.length <= 32768 &&
    !/[\r\n\0]/.test(value.token) &&
    typeof value.expiresAt === "number" &&
    Number.isSafeInteger(value.expiresAt) &&
    value.expiresAt > now &&
    identifier(value.userId) &&
    (value.projectId === null || identifier(value.projectId))
  );
};
// Injected storage only: no browser storage or real credential is accessed here.
export const clearResumeRecord = (storage: ResumeStorage) => {
  storage.removeItem(RESUME_KEY);
};
export const readResumeRecord = (
  storage: ResumeStorage,
  now = Date.now(),
): ResumeRecord | null => {
  const text = storage.getItem(RESUME_KEY);
  if (text === null) return null;
  let value: unknown;
  try {
    value = text.length <= 40000 ? (JSON.parse(text) as unknown) : null;
  } catch {
    value = null;
  }
  if (!validResumeRecord(value, now)) {
    clearResumeRecord(storage);
    return null;
  }
  return value;
};
export const writeResumeRecord = (
  storage: ResumeStorage,
  record: ResumeRecord,
  now = Date.now(),
) => {
  if (!validResumeRecord(record, now))
    throw Error("Sign-in session cannot be resumed.");
  // Explicit projection keeps fields, refresh tokens and unrelated data out.
  storage.setItem(
    RESUME_KEY,
    JSON.stringify({
      version: 1,
      instance: YOUTRACK_ORIGIN,
      token: record.token,
      expiresAt: record.expiresAt,
      userId: record.userId,
      projectId: record.projectId,
    }),
  );
};
