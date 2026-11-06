import { tw } from "@utils/tw";
import { useDelayedFlag } from "./use-delayed-flag";
interface PendingProps {
  active: boolean;
  label: string;
  message?: string;
  className?: string;
}
/** One reserved status line: spinner and label while slow work runs. */
const Pending = ({ active, label, message, className }: PendingProps) => {
  const shown = useDelayedFlag(active);
  return (
    <p
      className={tw("romdex-pending", className)}
      role="status"
      aria-live="polite"
      aria-busy={shown ? "true" : undefined}
    >
      {shown ? (
        <>
          <span className="romdex-spinner" aria-hidden="true" />
          {label}
        </>
      ) : (
        message
      )}
    </p>
  );
};
export default Pending;
