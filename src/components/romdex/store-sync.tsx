import { storeSync } from "@/store/browser/controller";
import type { StoreStatus } from "@/store/browser/status";
import type { StoreName } from "@/store/parts/manifest";
import { useState, useSyncExternalStore } from "react";

/*
 * Store sync status in Connection Details: one line per store, the actions
 * it needs (create after confirming, choose between articles, sync now) and
 * the review list for keys changed on two devices.
 */

const describe = (value: unknown) => {
  if (value === undefined) return "Removed";
  const text = JSON.stringify(value);
  return text.length > 120 ? text.slice(0, 117) + "…" : text;
};

const Review = ({ status }: { status: StoreStatus }) => {
  const settle = (key: string, choice: "mine" | "youtrack") => {
    return () => {
      void storeSync.settle(status.store, key, choice);
    };
  };
  return (
    <ul aria-label={`${status.title} needs review`}>
      {status.review.map((item) => {
        return (
          <li key={item.key}>
            <strong>{item.key}</strong> — this browser:{" "}
            <code>{describe(item.local)}</code>; YouTrack (
            {new Date(item.remoteWrittenAt).toLocaleString()}):{" "}
            <code>{describe(item.remote)}</code>
            <div className="port-actions">
              <button onClick={settle(item.key, "mine")}>Keep mine</button>
              <button onClick={settle(item.key, "youtrack")}>
                Keep YouTrack&apos;s
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const StoreRow = ({ status }: { status: StoreStatus }) => {
  const [confirming, setConfirming] = useState(false);
  const { store } = status;
  const run = (action: (name: StoreName) => Promise<void>) => {
    return () => {
      setConfirming(false);
      void action(store);
    };
  };
  const choose = (id: string) => {
    return () => {
      void storeSync.choose(store, id);
    };
  };
  return (
    <li>
      <p role="status">
        <strong>{status.title}:</strong> {status.message}{" "}
        <button
          onClick={run(storeSync.sync)}
          disabled={status.kind === "syncing"}
        >
          Sync now
        </button>
      </p>
      {status.kind === "not-set-up" &&
        (confirming ? (
          <>
            <p>
              Create a private &quot;{status.title}&quot; article in YouTrack,
              visible to thegobindsingh and GenericCola?
            </p>
            <div className="port-actions">
              <button onClick={run(storeSync.create)}>Create article</button>
              <button
                onClick={() => {
                  setConfirming(false);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => {
              setConfirming(true);
            }}
          >
            Set up in YouTrack…
          </button>
        ))}
      {status.ids.length > 0 && (
        <div className="port-actions">
          {status.ids.map((id) => {
            return (
              <button key={id} onClick={choose(id)}>
                Use {id}
              </button>
            );
          })}
        </div>
      )}
      {status.refused.map((part) => {
        return (
          <p key={part.key} role="alert">
            {part.message}
          </p>
        );
      })}
      {status.review.length > 0 && <Review status={status} />}
    </li>
  );
};

const StoreSync = () => {
  const statuses = useSyncExternalStore(
    storeSync.subscribe,
    storeSync.getSnapshot,
    storeSync.getSnapshot,
  );
  return (
    <section aria-label="YouTrack data sync">
      <ul className="port-notice">
        {Object.values(statuses).map((status) => {
          return <StoreRow key={status.store} status={status} />;
        })}
      </ul>
    </section>
  );
};
export default StoreSync;
