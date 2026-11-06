export interface DelayedFlagStep {
  /** Value the flag should take once `wait` ms have passed. */
  next: boolean;
  /** Ms until `next` applies, or null when the flag does not change. */
  wait: number | null;
}
/**
 * Decides when a loading flag flips. `elapsed` is the time since `active`
 * last became true while the flag is off, and since the flag turned on while
 * it is on.
 */
export const delayedFlagStep = (
  active: boolean,
  visible: boolean,
  elapsed: number,
  delay: number,
  minimum: number,
): DelayedFlagStep => {
  if (visible)
    return active
      ? { next: true, wait: null }
      : { next: false, wait: Math.max(0, minimum - elapsed) };
  return active
    ? { next: true, wait: Math.max(0, delay - elapsed) }
    : { next: false, wait: null };
};

/**
 * The minimum display only prevents loader-to-blank flicker. Once the work
 * has finished, a result message replaces the loader at once.
 */
export const loaderShown = (
  delayed: boolean,
  active: boolean,
  message: string | undefined,
) => {
  return delayed && (active || !message);
};
