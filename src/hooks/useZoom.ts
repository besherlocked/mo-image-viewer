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

      let delta: number;
      if (e.ctrlKey) {
        delta = -e.deltaY * 0.01;
      } else {
        delta = -Math.sign(e.deltaY) * 0.1;
      }

      const newZoom = Math.max(0.1, Math.min(20, zoom * (1 + delta)));
      if (Math.abs(newZoom - zoom) < 0.001) return;

      zoomRef.current = newZoom;
      setZoom(newZoom);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef]);
}
