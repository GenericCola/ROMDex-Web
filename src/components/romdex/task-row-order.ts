// The task table renders only the rows near the viewport, so drop targets read the full visible
// order from here. Without a mounted table (unit fixtures) they fall back to the rows in the DOM.
let published: readonly string[] | null = null;
export const publishRowOrder = (ids: readonly string[]) => {
  published = ids;
  const unpublishRowOrder = () => {
    if (published === ids) published = null;
  };
  return unpublishRowOrder;
};
export const rowOrder = (root: ParentNode): readonly string[] => {
  return (
    published ??
    [...root.querySelectorAll<HTMLElement>("[data-row]")].map((element) => {
      return element.dataset.row ?? "";
    })
  );
};
