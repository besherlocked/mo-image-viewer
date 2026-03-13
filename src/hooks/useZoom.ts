import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";

export function useZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
  const zoomRef = useRef(1);

  useEffect(() => {
    return useAppStore.subscribe((s) => {
      zoomRef.current = s.zoom;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const zoom = zoomRef.current;
      const { setZoom } = useAppStore.getState();

      const MIN_ZOOM = 0.1;
      const MAX_ZOOM = 4;

      let newZoom = zoom;
      if (e.ctrlKey) {
        // Trackpad pinch: use smooth exponential scaling
        const factor = Math.exp(-e.deltaY * 0.001);
        newZoom = zoom * factor;
      } else {
        // Mouse wheel: fixed step, smaller step when缩小，稍大步长放大
        const step = zoom < 1 ? 0.1 : 0.2;
        const direction = -Math.sign(e.deltaY) || 1;
        newZoom = zoom + direction * step;
      }

      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      if (Math.abs(newZoom - zoom) < 0.001) return;

      zoomRef.current = newZoom;
      setZoom(newZoom);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef]);
}
