export const rowClassName = (state: {
  dragging: boolean;
  drop: "before" | "after" | null;
  hasChildren: boolean;
  highlighted: boolean;
}) => {
  return (
    "task-row" +
    (state.dragging ? " dragging" : "") +
    (state.drop === "before"
      ? " drop-before"
      : state.drop === "after"
        ? " drop-after"
        : "") +
    (state.hasChildren ? " has-children" : "") +
    (state.highlighted ? " selected" : "")
  );
};
