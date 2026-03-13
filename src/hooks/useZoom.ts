import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";

export function useZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
  const stateRef = useRef({ zoom: 1, panX: 0, panY: 0 });

  useEffect(() => {
    return useAppStore.subscribe((s) => {
      stateRef.current = { zoom: s.zoom, panX: s.panX, panY: s.panY };
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const { zoom, panX, panY } = stateRef.current;
      const { setZoom, setPan } = useAppStore.getState();

      let factor: number;
      if (e.ctrlKey) {
        // Trackpad pinch: deltaY is small (-2 to 2), scale proportionally
        factor = 1 - e.deltaY * 0.01;
      } else {
        // Mouse wheel: deltaY is large (~100), use fixed steps
        const step = Math.sign(e.deltaY) * -0.1;
        factor = 1 + step;
      }

      const newZoom = Math.max(0.1, Math.min(20, zoom * factor));
      if (newZoom === zoom) return;

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;
      const zoomRatio = newZoom / zoom;
      const newPanX = mouseX - (mouseX - panX) * zoomRatio;
      const newPanY = mouseY - (mouseY - panY) * zoomRatio;

      stateRef.current = { zoom: newZoom, panX: newPanX, panY: newPanY };
      setPan(newPanX, newPanY);
      setZoom(newZoom);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef]);
}
