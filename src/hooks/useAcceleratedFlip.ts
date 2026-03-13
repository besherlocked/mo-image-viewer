import { useRef, useCallback } from "react";

const FLIP_INTERVAL = 200; // 200ms = 5 images per second

export function useAcceleratedFlip(onFlip: () => void) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHolding = useRef(false);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.repeat) return;
      isHolding.current = true;
      onFlip();
      timerRef.current = setInterval(() => {
        if (!isHolding.current) return;
        onFlip();
      }, FLIP_INTERVAL);
    },
    [onFlip]
  );

  const onKeyUp = useCallback(() => {
    isHolding.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { onKeyDown, onKeyUp };
}
