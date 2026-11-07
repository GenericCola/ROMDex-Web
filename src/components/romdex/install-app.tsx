import type { usePwa } from "@components/pwa-controls/use-pwa";
import Dialog from "./dialog";
// Install help and installed-app status inside the app (owner answer Q6).
const InstallApp = ({
  update,
  close,
}: {
  update: ReturnType<typeof usePwa>;
  close: () => void;
}) => {
  const handleInstall = () => {
    void update.installApp();
  };
  return (
    <Dialog title="Install ROMDex" close={close}>
      <p role="status">{update.installMessage}</p>
      {update.canInstall && (
        <div className="port-actions">
          <button onClick={handleInstall}>Install ROMDex</button>
        </div>
      )}
    </Dialog>
  );
};
export default InstallApp;
