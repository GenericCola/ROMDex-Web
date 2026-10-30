import { tw } from "@utils/tw";
import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";
import SessionNotice from "./session-notice";
interface DialogProps extends PropsWithChildren {
  title: string;
  close: () => void;
  className?: string;
  open?: boolean;
  canClose?: boolean;
}
const Dialog = ({
  title,
  close,
  children,
  className = "",
  open = true,
  canClose = true,
}: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const show = () => {
    if (!open) return;
    const dialog = ref.current;
    const opener = document.activeElement;
    if (dialog && !dialog.open) dialog.showModal();
    const hide = () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
    return hide;
  };
  useEffect(show, [open]);
  return (
    <dialog
      className={tw("port-dialog", className)}
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (canClose) close();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          aria-label={"Close " + title}
          disabled={!canClose}
          onClick={() => {
            if (canClose) close();
          }}
        >
          ×
        </button>
      </div>
      <SessionNotice />
      {children}
    </dialog>
  );
};
export default Dialog;
