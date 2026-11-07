import { useDelayedFlag } from "./use-delayed-flag";
const ROWS = ["a", "b", "c", "d", "e"];
const column = (name: string, count: number) => {
  return (
    <div key={name}>
      {ROWS.slice(0, count).map((row) => {
        return <div key={row} className="romdex-skeleton" aria-hidden="true" />;
      })}
    </div>
  );
};
/** Placeholder for the selector, table and details while the workspace opens. */
const WorkspaceSkeleton = () => {
  const shown = useDelayedFlag(true);
  return (
    <div
      className="romdex-workspace-skeleton"
      role="status"
      aria-busy={shown ? "true" : undefined}
    >
      {shown && (
        <>
          <span className="sr-only">Opening your workspace…</span>
          {column("selector", 4)}
          {column("table", 5)}
          {column("details", 3)}
        </>
      )}
    </div>
  );
};
export default WorkspaceSkeleton;
