import { useState, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store/appStore";
import type { KeyBindings } from "../types";

function formatKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");

  const key = e.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
    parts.push(key.length === 1 ? key.toLowerCase() : key);
  }

  return parts.join("+");
}

interface KeyBindingRowProps {
  label: string;
  value: string;
  onCapture: (key: string) => void;
}

function KeyBindingRow({ label, value, onCapture }: KeyBindingRowProps) {
  const [capturing, setCapturing] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!capturing) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      const formatted = formatKey(e);
      onCapture(formatted);
      setCapturing(false);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing, onCapture]);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-white/80">{label}</span>
      <div
        ref={inputRef}
        onClick={() => setCapturing(true)}
        className={`
          min-w-[140px] px-3 py-1.5 rounded border text-center cursor-pointer text-sm
          ${
            capturing
              ? "border-cyan-400 bg-cyan-400/10 text-cyan-300 animate-pulse"
              : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"
          }
        `}
      >
        {capturing ? "请按下按键..." : value}
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const { showSettings, setShowSettings, settings, saveSettings } =
    useAppStore();
  const [bindings, setBindings] = useState<KeyBindings>(
    settings.key_bindings
  );

  useEffect(() => {
    setBindings(settings.key_bindings);
  }, [settings.key_bindings]);

  const handleSave = useCallback(() => {
    saveSettings({ ...settings, key_bindings: bindings });
    setShowSettings(false);
  }, [bindings, settings, saveSettings, setShowSettings]);

  const handleCancel = useCallback(() => {
    setBindings(settings.key_bindings);
    setShowSettings(false);
  }, [settings.key_bindings, setShowSettings]);

  const updateBinding = useCallback(
    (key: keyof KeyBindings, value: string) => {
      setBindings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  if (!showSettings) return null;

  const rows: { key: keyof KeyBindings; label: string }[] = [
    { key: "prev_image", label: "上一张图片" },
    { key: "next_image", label: "下一张图片" },
    { key: "prev_folder", label: "上一个文件夹" },
    { key: "next_folder", label: "下一个文件夹" },
    { key: "reset_zoom", label: "重置缩放" },
    { key: "rotate_cw", label: "顺时针旋转" },
    { key: "rotate_ccw", label: "逆时针旋转" },
    { key: "flip_h", label: "水平翻转" },
    { key: "flip_v", label: "垂直翻转" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-white/10 rounded-xl p-6 w-[420px] shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">快捷键设置</h2>

        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
          {rows.map((row) => (
            <KeyBindingRow
              key={row.key}
              label={row.label}
              value={bindings[row.key]}
              onCapture={(v) => updateBinding(row.key, v)}
            />
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-sm text-white/70 hover:bg-white/10 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
