import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

export function usePreloader() {
  const currentIndex = useAppStore((s) => s.currentIndex);
  const images = useAppStore((s) => s.images);
  const preloadAround = useAppStore((s) => s.preloadAround);

  useEffect(() => {
    if (images.length === 0) return;
    preloadAround(currentIndex);
  }, [currentIndex, images, preloadAround]);
}
