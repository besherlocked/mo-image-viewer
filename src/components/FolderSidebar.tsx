import { useState, useCallback, useRef, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { ThumbnailGrid } from "./ThumbnailGrid";

export function FolderSidebar() {
  const { siblingFolders, currentFolder } = useAppStore();
  const [visible, setVisible] = useState(false);
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const folderHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimeouts = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (folderHideTimeoutRef.current) {
      clearTimeout(folderHideTimeoutRef.current);
      folderHideTimeoutRef.current = null;
    }
  }, []);

  const showPanel = useCallback(() => {
    clearAllTimeouts();
    setVisible(true);
  }, [clearAllTimeouts]);

  const scheduleHide = useCallback(() => {
    clearAllTimeouts();
    hideTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setHoveredFolder(null);
    }, 300);
  }, [clearAllTimeouts]);

  const handleFolderHover = useCallback(
    (folderPath: string) => {
      if (folderHideTimeoutRef.current) {
        clearTimeout(folderHideTimeoutRef.current);
        folderHideTimeoutRef.current = null;
      }
      setHoveredFolder(folderPath);
    },
    []
  );

  const scheduleFolderHide = useCallback(() => {
    folderHideTimeoutRef.current = setTimeout(() => {
      setHoveredFolder(null);
    }, 300);
  }, []);

  const handleThumbnailEnter = useCallback(() => {
    clearAllTimeouts();
  }, [clearAllTimeouts]);

  const handleThumbnailLeave = useCallback(() => {
    scheduleFolderHide();
    scheduleHide();
  }, [scheduleFolderHide, scheduleHide]);

  const handleFolderClick = useCallback((folderPath: string) => {
    useAppStore.getState().openFolder(folderPath, 0);
    setVisible(false);
    setHoveredFolder(null);
  }, []);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  if (siblingFolders.length === 0) return null;

  return (
    <>
      {/* Hover trigger zone */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[30px] z-30"
        onMouseEnter={showPanel}
        onMouseLeave={scheduleHide}
      />

      {/* Folder list panel */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 z-30
          bg-gray-900/95 backdrop-blur-md border-r border-white/10
          transition-transform duration-200 ease-out
          ${visible ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ width: 220 }}
        onMouseEnter={showPanel}
        onMouseLeave={scheduleHide}
      >
        <div className="p-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70">文件夹</h3>
        </div>
        <div className="overflow-y-auto h-[calc(100%-44px)]">
          {siblingFolders.map((folder) => {
            const isCurrent = folder.path === currentFolder;
            return (
              <div
                key={folder.path}
                className={`
                  px-3 py-2 cursor-pointer text-sm border-l-2 transition-colors
                  ${
                    isCurrent
                      ? "border-cyan-400 bg-cyan-400/10 text-white"
                      : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  }
                `}
                onClick={() => handleFolderClick(folder.path)}
                onMouseEnter={() => handleFolderHover(folder.path)}
                onMouseLeave={scheduleFolderHide}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{folder.name}</span>
                  <span className="text-xs opacity-50 ml-2 shrink-0">
                    {folder.image_count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thumbnail popup */}
      {visible && hoveredFolder && (
        <div
          className="absolute z-40 bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl overflow-y-auto"
          style={{ left: 224, top: 40, width: 280, maxHeight: 400 }}
          onMouseEnter={handleThumbnailEnter}
          onMouseLeave={handleThumbnailLeave}
        >
          <ThumbnailGrid folder={hoveredFolder} />
        </div>
      )}
    </>
  );
}
