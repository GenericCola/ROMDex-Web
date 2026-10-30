// Desktop field-tags.mjs, GenericCola/ROMDex 28c0ce4.
export const fieldChoices = {
  priority: [
    { value: "Minor", label: "LOW", color: "green" },
    { value: "Normal", label: "NORMAL", color: "blue" },
    { value: "Major", label: "HIGH", color: "yellow" },
    { value: "Critical", label: "URGENT", color: "red" },
  ],
  complexity: [
    { value: "LOW", label: "LOW", color: "green" },
    { value: "MID", label: "MID", color: "blue" },
    { value: "HIGH", label: "HIGH", color: "yellow" },
    { value: "INSANE", label: "INSANE", color: "red" },
  ],
};
export const fieldPresentation = (
  field: keyof typeof fieldChoices,
  value: string | null,
) => {
  if (field === "priority" && value === "Show-stopper")
    return { value, label: "URGENT", color: "red" };
  return (
    fieldChoices[field].find((choice) => {
      return choice.value === value;
    }) ?? {
      value,
      label: value === null ? "—" : value.toUpperCase() + " ⚠",
      color: "unset",
    }
  );
};
