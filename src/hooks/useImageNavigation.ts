import { useEffect, useCallback } from "react";
import { useAppStore } from "../store/appStore";
import { useAcceleratedFlip } from "./useAcceleratedFlip";

function matchKey(e: KeyboardEvent, binding: string): boolean {
  const parts = binding.split("+").map((p) => p.trim().toLowerCase());
  const key = parts[parts.length - 1];
  const needShift = parts.includes("shift");
  const needCtrl = parts.includes("ctrl") || parts.includes("control");
  const needAlt = parts.includes("alt");
  const needMeta = parts.includes("meta") || parts.includes("cmd");

  return (
    e.key.toLowerCase() === key &&
    e.shiftKey === needShift &&
    e.ctrlKey === needCtrl &&
    e.altKey === needAlt &&
    e.metaKey === needMeta
  );
}

export function useImageNavigation() {
  const {
    settings,
    nextImage,
    prevImage,
    nextFolder,
    prevFolder,
    resetView,
    rotateCW,
    rotateCCW,
    toggleFlipH,
    toggleFlipV,
    toggleFullscreen,
    showSettings,
    showContextMenu,
  } = useAppStore();

  const kb = settings.key_bindings;

  const { onKeyDown: onNextDown, onKeyUp: onNextUp } = useAcceleratedFlip(nextImage);
  const { onKeyDown: onPrevDown, onKeyUp: onPrevUp } = useAcceleratedFlip(prevImage);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showSettings) return;

      if (matchKey(e, kb.next_image)) {
        e.preventDefault();
        onNextDown(e);
      } else if (matchKey(e, kb.prev_image)) {
        e.preventDefault();
        onPrevDown(e);
      } else if (matchKey(e, kb.next_folder)) {
        e.preventDefault();
        nextFolder();
      } else if (matchKey(e, kb.prev_folder)) {
        e.preventDefault();
        prevFolder();
      } else if (matchKey(e, kb.reset_zoom)) {
        e.preventDefault();
        resetView();
      } else if (matchKey(e, kb.rotate_cw)) {
        e.preventDefault();
        rotateCW();
      } else if (matchKey(e, kb.rotate_ccw)) {
        e.preventDefault();
        rotateCCW();
      } else if (matchKey(e, kb.flip_h)) {
        e.preventDefault();
        toggleFlipH();
      } else if (matchKey(e, kb.flip_v)) {
        e.preventDefault();
        toggleFlipV();
      } else if (e.key === "F11" || (e.metaKey && e.key === "Enter")) {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "Escape") {
        if (showContextMenu) {
          useAppStore.getState().setShowContextMenu(false);
        }
      }
    },
    [
      kb, showSettings, showContextMenu, onNextDown, onPrevDown,
      nextFolder, prevFolder, resetView, rotateCW, rotateCCW,
      toggleFlipH, toggleFlipV, toggleFullscreen,
    ]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (matchKey(e, kb.next_image)) onNextUp();
      if (matchKey(e, kb.prev_image)) onPrevUp();
    },
    [kb, onNextUp, onPrevUp]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
