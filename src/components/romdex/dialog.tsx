import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";
interface DialogProps extends PropsWithChildren {
  title: string;
  close: () => void;
}
const Dialog = ({ title, close, children }: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const show = () => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const hide = () => {
      return dialog?.close();
    };
    return hide;
  };
  useEffect(show, []);
  return (
    <dialog
      className="port-dialog"
      ref={ref}
      aria-label={title}
      onCancel={close}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button type="button" aria-label={"Close " + title} onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
};
export default Dialog;
