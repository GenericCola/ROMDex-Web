import type { usePwa } from "@components/pwa-controls/use-pwa";
import Image from "next/image";
import Dialog from "./dialog";
const UpdateCheck = ({
  update,
  close,
}: {
  update: ReturnType<typeof usePwa>;
  close: () => void;
}) => {
  return (
    <Dialog
      title="Check for updates"
      close={close}
      className="romdex-update-dialog"
      canClose={!update.applying}
    >
      <div className="romdex-update-progress" data-checking={update.checking}>
        {update.checking && (
          <Image
            className="romdex-update-spinner"
            src="/romdex/update-pokeball.svg"
            width={64}
            height={64}
            alt=""
          />
        )}
        <p role="status" aria-live="polite">
          {update.message}
        </p>
      </div>
      {update.hasUpdate && (
        <button
          disabled={update.checking || update.applying}
          onClick={() => {
            void update.reloadToUpdate();
          }}
        >
          Apply update
        </button>
      )}
      {!update.checking && !update.applying && (
        <button
          onClick={() => {
            void update.checkForUpdates();
          }}
        >
          Check again
        </button>
      )}
    </Dialog>
  );
};
export default UpdateCheck;
