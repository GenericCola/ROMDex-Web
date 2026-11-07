import { storeSync } from "@/store/browser/controller";
import { useEffect, useSyncExternalStore } from "react";

/**
 * One line outside Connection Details when a store needs the user. The app
 * shell always renders it, so it also starts and stops background sync.
 */
const StoreNotice = ({ review }: { review: () => void }) => {
  useEffect(() => {
    return storeSync.start();
  }, []);
  const statuses = useSyncExternalStore(
    storeSync.subscribe,
    storeSync.getSnapshot,
    storeSync.getSnapshot,
  );
  const needs = Object.values(statuses).filter((status) => {
    return status.review.length > 0 || status.refused.length > 0;
  });
  if (!needs.length) return null;
  return (
    <p className="port-notice" role="status">
      {needs
        .map((status) => {
          return `${status.title}: ${status.message}`;
        })
        .join(" ")}{" "}
      <button onClick={review}>Review</button>
    </p>
  );
};
export default StoreNotice;
