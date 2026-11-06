import { useEffect, useRef, useState } from "react";
import { delayedFlagStep } from "./delayed-flag-step";
/**
 * True once `active` has held for `delay` ms, then for at least `minimum` ms
 * after it turned on. Fast work never flashes a loader; medium work does not
 * flicker one.
 */
export const useDelayedFlag = (
  active: boolean,
  delay = 250,
  minimum = 400,
): boolean => {
  const [visible, setVisible] = useState(false);
  const marksRef = useRef({ active: 0, visible: 0, wasActive: false });
  useEffect(() => {
    const now = Date.now();
    const mark = marksRef.current;
    if (active && !mark.wasActive) mark.active = now;
    mark.wasActive = active;
    const step = delayedFlagStep(
      active,
      visible,
      now - (visible ? mark.visible : mark.active),
      delay,
      minimum,
    );
    if (step.wait === null) return undefined;
    const flip = () => {
      if (step.next) mark.visible = Date.now();
      setVisible(step.next);
    };
    const timer = setTimeout(flip, step.wait);
    return () => {
      clearTimeout(timer);
    };
  }, [active, visible, delay, minimum]);
  return visible;
};
