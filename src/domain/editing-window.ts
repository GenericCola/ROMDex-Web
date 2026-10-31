export const EDITING_IDLE_MS = 300000;
interface Timers {
  set: (action: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clear: (timer: ReturnType<typeof setTimeout>) => void;
}
// Timers hold only automatic sending. They never own or discard editor content.
export class EditingWindow {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    private changed: () => void,
    private clock: Timers = {
      set: (action, delay) => {
        return setTimeout(action, delay);
      },
      clear: (timer) => {
        clearTimeout(timer);
      },
    },
  ) {}
  touch(key: string) {
    this.remove(key);
    this.timers.set(
      key,
      this.clock.set(() => {
        this.timers.delete(key);
        this.changed();
      }, EDITING_IDLE_MS),
    );
    this.changed();
  }
  remove(key: string) {
    const timer = this.timers.get(key);
    if (timer !== undefined) this.clock.clear(timer);
    this.timers.delete(key);
  }
  keys() {
    return [...this.timers.keys()];
  }
}
