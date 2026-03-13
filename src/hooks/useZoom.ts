import { useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";

export function useZoom(containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const { zoom, panX, panY, setZoom, setPan } = useAppStore.getState();

      const MIN_ZOOM = 0.05;
      const MAX_ZOOM = 8;

      // Current mouse position and container center
      const rect = el.getBoundingClientRect();
      const mx = e.clientX;
      const my = e.clientY;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      let newZoom = zoom;
      if (e.ctrlKey) {
        // Trackpad pinch → smooth exponential scaling
        const factor = Math.exp(-e.deltaY * 0.001);
        newZoom = zoom * factor;
      } else {
        // Mouse wheel → simple step scaling
        const direction = -Math.sign(e.deltaY) || 1; // 上滚放大，下滚缩小
        const step = zoom < 1 ? 0.1 : 0.2;
        newZoom = zoom + direction * step;
      }

      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      if (Math.abs(newZoom - zoom) < 0.001 || zoom <= 0) return;

      // 调整平移，使鼠标指向的图像点在缩放前后保持在同一屏幕位置
      const vx = mx - cx - panX;
      const vy = my - cy - panY;
      const scale = newZoom / zoom;
      const newPanX = panX + vx * (1 - scale);
      const newPanY = panY + vy * (1 - scale);

      setZoom(newZoom);
      setPan(newPanX, newPanY);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [containerRef]);
}
