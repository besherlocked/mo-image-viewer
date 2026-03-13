import { useAppStore } from "../store/appStore";
import type { BackgroundMode } from "../types";

const ICONS: Record<BackgroundMode, string> = {
  dark: "🌙",
  light: "☀️",
  gray: "🔘",
  checkerboard: "🏁",
};

const LABELS: Record<BackgroundMode, string> = {
  dark: "深色",
  light: "浅色",
  gray: "灰色",
  checkerboard: "棋盘格",
};

export function BackgroundToggle() {
  const { background, cycleBackground } = useAppStore();

  return (
    <button
      onClick={cycleBackground}
      className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white text-xs transition-all select-none"
      title={`背景: ${LABELS[background]}`}
    >
      <span>{ICONS[background]}</span>
      <span>{LABELS[background]}</span>
    </button>
  );
}
