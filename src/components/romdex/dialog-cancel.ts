export const cancelDialog = (
  event: { preventDefault: () => void; stopPropagation: () => void },
  canClose: boolean,
  close: () => void,
) => {
  event.preventDefault();
  event.stopPropagation();
  if (canClose) close();
};
