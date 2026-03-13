import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/appStore";
import type { FitMode, BackgroundMode, AppSettings } from "../types";

interface SubMenuProps {
  label: string;
  children: React.ReactNode;
}

function SubMenu({ label, children }: SubMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center justify-between px-3 py-1.5 hover:bg-white/10 cursor-default rounded">
        <span>{label}</span>
        <span className="ml-4 text-xs opacity-60">▸</span>
      </div>
      {open && (
        <div className="absolute left-full top-0 ml-1 bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-lg py-1 min-w-[140px] shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  label: string;
  checked?: boolean;
  onClick: () => void;
  shortcut?: string;
}

function MenuItem({ label, checked, onClick, shortcut }: MenuItemProps) {
  return (
    <div
      className="flex items-center justify-between px-3 py-1.5 hover:bg-white/10 cursor-default rounded mx-1"
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        {checked !== undefined && (
          <span className="w-4 text-center">{checked ? "✓" : ""}</span>
        )}
        <span>{label}</span>
      </span>
      {shortcut && (
        <span className="text-xs opacity-40 ml-4">{shortcut}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-white/10" />;
}

export function ContextMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    showContextMenu,
    contextMenuPos,
    setShowContextMenu,
    fitMode,
    setFitMode,
    background,
    setBackground,
    settings,
    saveSettings,
    rotateCW,
    rotateCCW,
    toggleFlipH,
    toggleFlipV,
    resetView,
    setShowSettings,
  } = useAppStore();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };
    if (showContextMenu) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showContextMenu, setShowContextMenu]);

  if (!showContextMenu) return null;

  const fitModes: { mode: FitMode; label: string }[] = [
    { mode: "contain", label: "适应窗口" },
    { mode: "width", label: "适应宽度" },
    { mode: "height", label: "适应高度" },
    { mode: "original", label: "原始大小 1:1" },
  ];

  const backgrounds: { mode: BackgroundMode; label: string }[] = [
    { mode: "dark", label: "深色" },
    { mode: "light", label: "浅色" },
    { mode: "gray", label: "灰色" },
    { mode: "checkerboard", label: "棋盘格" },
  ];

  const handleTogglePassThrough = () => {
    const newSettings = {
      ...settings,
      pass_through_folders: !settings.pass_through_folders,
    };
    saveSettings(newSettings);
  };

  const close = () => setShowContextMenu(false);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800/95 backdrop-blur-md border border-white/10 rounded-lg py-1 min-w-[180px] text-sm text-white/90 shadow-2xl select-none"
      style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
    >
      <SubMenu label="适配模式">
        {fitModes.map((fm) => (
          <MenuItem
            key={fm.mode}
            label={fm.label}
            checked={fitMode === fm.mode}
            onClick={() => {
              setFitMode(fm.mode);
              close();
            }}
          />
        ))}
      </SubMenu>

      <SubMenu label="旋转 / 翻转">
        <MenuItem
          label="顺时针旋转 90°"
          onClick={() => { rotateCW(); close(); }}
          shortcut={settings.key_bindings.rotate_cw}
        />
        <MenuItem
          label="逆时针旋转 90°"
          onClick={() => { rotateCCW(); close(); }}
          shortcut={settings.key_bindings.rotate_ccw}
        />
        <Divider />
        <MenuItem
          label="水平翻转"
          onClick={() => { toggleFlipH(); close(); }}
          shortcut={settings.key_bindings.flip_h}
        />
        <MenuItem
          label="垂直翻转"
          onClick={() => { toggleFlipV(); close(); }}
          shortcut={settings.key_bindings.flip_v}
        />
        <Divider />
        <MenuItem label="重置" onClick={() => { resetView(); close(); }} shortcut={settings.key_bindings.reset_zoom} />
      </SubMenu>

      <SubMenu label="背景">
        {backgrounds.map((bg) => (
          <MenuItem
            key={bg.mode}
            label={bg.label}
            checked={background === bg.mode}
            onClick={() => {
              setBackground(bg.mode);
              close();
            }}
          />
        ))}
      </SubMenu>

      <Divider />

      <SubMenu label="左侧边栏范围">
        {[1, 2, 3].map((n) => (
          <MenuItem
            key={n}
            label={`父目录前后 ${n} 层`}
            checked={settings.sidebar_parent_range === n}
            onClick={() => {
              const newSettings: AppSettings = {
                ...settings,
                sidebar_parent_range: n,
              };
              saveSettings(newSettings);
              close();
            }}
          />
        ))}
        <Divider />
        {[5, 10, 20].map((n) => (
          <MenuItem
            key={n}
            label={`每层最多 ${n} 个文件夹`}
            checked={settings.sidebar_max_children === n}
            onClick={() => {
              const newSettings: AppSettings = {
                ...settings,
                sidebar_max_children: n,
              };
              saveSettings(newSettings);
              close();
            }}
          />
        ))}
      </SubMenu>

      <Divider />

      <MenuItem
        label="穿透文件夹"
        checked={settings.pass_through_folders}
        onClick={handleTogglePassThrough}
      />

      <MenuItem
        label="快捷键设置..."
        onClick={() => {
          setShowSettings(true);
          close();
        }}
      />
    </div>
  );
}
