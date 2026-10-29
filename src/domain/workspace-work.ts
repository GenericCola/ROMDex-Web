// Work outlives its dialog: switching accounts must wait even after unmount.
const pending = new Set<Promise<void>>();
export const trackWorkspaceWork = (action: () => Promise<void>) => {
  const work = Promise.resolve().then(action);
  pending.add(work);
  const finish = () => {
    pending.delete(work);
  };
  void work.then(finish, finish);
  return work;
};
export const hasWorkspaceWork = () => {
  return pending.size > 0;
};
export const flushWorkspaceWork = async () => {
  while (pending.size) await Promise.all([...pending]);
};
