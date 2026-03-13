import { useRef, useCallback } from "react";

export function useAcceleratedFlip(onFlip: () => void) {
  const holdStartRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHolding = useRef(false);

  const getInterval = (holdDurationMs: number): number => {
    const MAX_DURATION = 5000;
    const START_INTERVAL = 500;
    const MIN_INTERVAL = 30;
    const progress = Math.min(holdDurationMs / MAX_DURATION, 1);
    const eased = progress * progress;
    return START_INTERVAL - (START_INTERVAL - MIN_INTERVAL) * eased;
  };

  const scheduleNext = useCallback(() => {
    if (!isHolding.current || holdStartRef.current === null) return;
    const elapsed = Date.now() - holdStartRef.current;
    const interval = getInterval(elapsed);

    timerRef.current = setTimeout(() => {
      if (!isHolding.current) return;
      onFlip();
      scheduleNext();
    }, interval);
  }, [onFlip]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      isHolding.current = true;
      holdStartRef.current = Date.now();
      onFlip();
      scheduleNext();
    },
    [onFlip, scheduleNext]
  );

  const onKeyUp = useCallback(() => {
    isHolding.current = false;
    holdStartRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onKeyDown, onKeyUp };
}
