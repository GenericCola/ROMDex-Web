import { useCallback, useLayoutEffect, useRef } from "react";
// Returns a function whose identity never changes but which always calls the
// latest closure passed in. Keeps memoized children from re-rendering.
export const useStableCallback = <Args extends unknown[], Result>(
  latest: (...args: Args) => Result,
) => {
  const ref = useRef(latest);
  useLayoutEffect(() => {
    ref.current = latest;
  });
  const stable = useCallback((...args: Args) => {
    return ref.current(...args);
  }, []);
  return stable;
};
