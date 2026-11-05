import { HttpFailure } from "./runtime-types.ts";
import { boundedText } from "./transport-bounds.ts";

export async function cookieInput(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const text = await boundedText(request.body, 256);
    if (!text) return {};
    if (
      request.headers.get("content-type")?.split(";")[0]?.trim() !==
      "application/json"
    )
      throw new HttpFailure(415);
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new HttpFailure(400);
    return value as Record<string, unknown>;
  } catch (error) {
    throw error instanceof HttpFailure ? error : new HttpFailure(400);
  }
}
