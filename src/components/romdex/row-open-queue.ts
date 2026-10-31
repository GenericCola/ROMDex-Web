export interface RowOpenContext {
  scope: string | null;
  workspace: string;
  epoch: number;
  editing: boolean;
  modal: boolean;
}
export const mayOpenDelayedRow = (
  before: RowOpenContext,
  current: RowOpenContext,
) => {
  return (
    before.scope === current.scope &&
    before.workspace === current.workspace &&
    before.epoch === current.epoch &&
    !current.editing &&
    !current.modal
  );
};
interface QueueClock {
  after: (callback: () => void, delay: number) => () => void;
  interrupt: (cancel: () => void) => () => void;
}
// One pending Work-row intent, like the original desktop workOpenTimer.
export const createRowOpenQueue = (clock: QueueClock) => {
  let active: { owner: symbol; stop: () => void } | null = null;
  const cancel = (owner?: symbol) => {
    if (!active || (owner !== undefined && active.owner !== owner)) return;
    active.stop();
    active = null;
  };
  const schedule = (
    owner: symbol,
    allowed: () => boolean,
    open: () => void,
  ) => {
    cancel();
    let live = true;
    const stopInterrupt = clock.interrupt(() => {
      cancel();
    });
    const stopTimer = clock.after(() => {
      if (!live) return;
      live = false;
      active = null;
      stopInterrupt();
      if (allowed()) open();
    }, 220);
    active = {
      owner,
      stop: () => {
        live = false;
        stopTimer();
        stopInterrupt();
      },
    };
  };
  return { schedule, cancel };
};
