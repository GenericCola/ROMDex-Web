import type { YouTrackRequest } from "@/youtrack/request";
export const CORS_MIGRATION_ORIGIN = "https://romdex.vercel.app";
const route =
  "admin/globalSettings/restSettings?fields=allowAllOrigins,allowedOrigins";
export interface CorsMigrationPreview {
  baseline: string[];
  proposed: string[];
  needed: boolean;
}
export interface CorsMigrationResult {
  status: "verified" | "uncertain";
  current?: CorsMigrationPreview;
  message: string;
}
const attempted = new WeakSet<CorsMigrationPreview>();
const validOrigins = (value: unknown): value is string[] => {
  if (!Array.isArray(value)) return false;
  return value.every((origin: unknown) => {
    if (typeof origin !== "string" || origin.includes("*")) return false;
    try {
      const url = new URL(origin);
      return (
        ["https:", "http:"].includes(url.protocol) && url.origin === origin
      );
    } catch {
      return false;
    }
  });
};
const equal = (a: string[], b: string[]) => {
  return (
    a.length === b.length &&
    a.every((value, i) => {
      return value === b[i];
    })
  );
};
export const readCorsMigration = async (
  request: YouTrackRequest,
): Promise<CorsMigrationPreview> => {
  const raw = await request(route);
  if (!raw || typeof raw !== "object")
    throw Error(
      "YouTrack returned invalid CORS settings. Nothing was changed.",
    );
  const value = raw as Record<string, unknown>;
  if (value.allowAllOrigins !== false || !validOrigins(value.allowedOrigins))
    throw Error(
      "CORS migration requires an explicit origin list without wildcards. Nothing was changed.",
    );
  const baseline = [...value.allowedOrigins];
  const needed = !baseline.includes(CORS_MIGRATION_ORIGIN);
  return {
    baseline,
    proposed: needed ? [...baseline, CORS_MIGRATION_ORIGIN] : [...baseline],
    needed,
  };
};
export const applyCorsMigration = async (
  request: YouTrackRequest,
  preview: CorsMigrationPreview,
): Promise<CorsMigrationResult> => {
  if (
    !validOrigins(preview.baseline) ||
    preview.baseline.includes(CORS_MIGRATION_ORIGIN) ||
    !preview.needed ||
    !validOrigins(preview.proposed) ||
    !equal(preview.proposed, [...preview.baseline, CORS_MIGRATION_ORIGIN]) ||
    attempted.has(preview)
  )
    throw Error(
      "This CORS preview cannot be applied. Read settings for review; do not retry an uncertain change.",
    );
  const baseline = [...preview.baseline];
  const proposed = [...preview.proposed];
  const fresh = await readCorsMigration(request);
  if (!equal(fresh.baseline, baseline))
    throw Error(
      "CORS settings changed since review. Nothing was sent; review the new settings.",
    );
  // Mark before dispatch: a timeout or rejected response cannot prove no write.
  if (attempted.has(preview))
    throw Error("This CORS change was already attempted. Read settings only.");
  attempted.add(preview);
  try {
    await request(route, "POST", {
      allowAllOrigins: false,
      allowedOrigins: proposed,
    });
    const current = await readCorsMigration(request);
    if (!equal(current.baseline, proposed))
      return {
        status: "uncertain",
        current,
        message:
          "CORS readback differs from the reviewed change. Review settings; do not resend.",
      };
    return {
      status: "verified",
      current,
      message: "The exact CORS origin list was read back and verified.",
    };
  } catch {
    return {
      status: "uncertain",
      message:
        "The CORS change may have reached YouTrack. Read settings for review only; do not resend.",
    };
  }
};
