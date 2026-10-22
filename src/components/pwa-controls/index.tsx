"use client";
import Button from "@components/button";
import { usePwa } from "./use-pwa";
const PwaControls = () => {
  const { canInstall, hasUpdate, message, installApp, reloadToUpdate } =
    usePwa();
  const handleInstall = () => {
    void installApp();
  };
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm text-fg-muted">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        {canInstall && <Button onClick={handleInstall}>Install ROMDex</Button>}
        {hasUpdate && (
          <Button onClick={reloadToUpdate}>Reload to update</Button>
        )}
      </div>
    </div>
  );
};
export default PwaControls;
