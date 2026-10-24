export const queueObject = (
  value: unknown,
): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};
export const queueText = (value: unknown) => {
  return typeof value === "string" && value.length > 0;
};
export const invalidQueue = (): never => {
  throw Error(
    "The cloud queue or delivery journal is invalid. Existing browser data has been kept. Delivery is blocked until repaired.",
  );
};
