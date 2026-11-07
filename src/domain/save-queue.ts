/*
 * Coalesces workspace saves. Changes made while a save is waiting or running
 * join the next save, which writes only the newest snapshot. A change's promise
 * resolves only after a save that includes it has finished, so every change is
 * still durable before its caller continues. The next save starts after a short
 * quiet period, or at once when `now()` is called (flush, delivery, app update,
 * page hide).
 */
interface Batch {
  count: number;
  open: () => void;
  done: Promise<void>;
  timer: ReturnType<typeof setTimeout> | undefined;
}
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();
  private next: Batch | undefined;
  constructor(
    /** Writes the newest snapshot; must not reject (report failures itself). */
    private save: (count: number) => Promise<void>,
    private delay = 0,
  ) {}
  /** Adds one change to the next save and answers when that save finished. */
  add = (urgent: boolean) => {
    const batch = this.next ?? this.open();
    batch.count++;
    if (urgent) this.start(batch);
    return batch.done;
  };
  /** Starts the waiting save now instead of after the quiet period. */
  now = () => {
    if (this.next) this.start(this.next);
  };
  /** Runs work after every save queued so far. */
  after = (work: () => Promise<void>) => {
    this.now();
    const result = this.tail.then(work);
    const keepQueueUsable = () => {
      // The caller keeps the failure; later saves still run.
    };
    this.tail = result.catch(keepQueueUsable);
    return result;
  };
  /** The promise of the last queued save. */
  settled = () => {
    this.now();
    return this.tail;
  };
  private start = (batch: Batch) => {
    if (batch.timer !== undefined) clearTimeout(batch.timer);
    batch.timer = undefined;
    batch.open();
  };
  private open = () => {
    let open = () => {
      // Replaced below before anyone can call it.
    };
    const makeGate = (resolve: () => void) => {
      open = resolve;
    };
    const gate = new Promise<void>(makeGate);
    const batch: Batch = { count: 0, open, done: gate, timer: undefined };
    const run = async () => {
      await gate;
      // Changes from here on join a later save.
      if (this.next === batch) this.next = undefined;
      await this.save(batch.count);
    };
    batch.done = this.tail.then(run);
    this.tail = batch.done;
    this.next = batch;
    if (this.delay > 0)
      batch.timer = setTimeout(() => {
        this.start(batch);
      }, this.delay);
    else queueMicrotask(open);
    return batch;
  };
}
