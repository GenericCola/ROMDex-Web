export const nativeEditKey = (key: string) => {
  return (
    key === "assignee" || key === "dueDate" || /^custom:[-\w]{1,100}$/.test(key)
  );
};
export const nativePatchValue = (key: string, value: unknown) => {
  if (!nativeEditKey(key)) return false;
  if (key === "assignee" || key === "dueDate")
    return value === null || typeof value === "string";
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) &&
      value.every((entry) => {
        return typeof entry === "string";
      }) &&
      new Set(value).size === value.length)
  );
};
