import { tw } from "@utils/tw";
import type { PropsWithChildren } from "react";
import { useEffect, useRef } from "react";
import { cancelDialog } from "./dialog-cancel";
import SessionNotice from "./session-notice";
interface DialogProps extends PropsWithChildren {
  title: string;
  id?: string;
  close: () => void;
  className?: string;
  open?: boolean;
  canClose?: boolean;
  desktop?: boolean;
}
const Dialog = ({
  title,
  id,
  close,
  children,
  className = "",
  open = true,
  canClose = true,
  desktop = false,
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
      id={id}
      className={tw(desktop ? "desktop-dialog" : "port-dialog", className)}
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        cancelDialog(event, canClose, close);
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
