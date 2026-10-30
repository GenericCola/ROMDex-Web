interface Keys {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  modal?: boolean;
  busy?: boolean;
  inlineName?: boolean;
  navigation?: boolean;
  selectedCount?: number;
  hasSelection?: boolean;
  fieldFocused?: boolean;
}
export function tabAction(
  input: Keys,
): "indent" | "outdent" | "cycle" | "group" | null;
export function escapeAction(input: Keys): "clear" | "toggle" | null;
