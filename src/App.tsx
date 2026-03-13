import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./store/appStore";
import { useImageNavigation } from "./hooks/useImageNavigation";
import { usePreloader } from "./hooks/usePreloader";
import { useSettings } from "./hooks/useSettings";
import { ImageCanvas } from "./components/ImageCanvas";
import { MiniMap } from "./components/MiniMap";
import { ContextMenu } from "./components/ContextMenu";
import { SettingsDialog } from "./components/SettingsDialog";
import { FolderSidebar } from "./components/FolderSidebar";
import { BackgroundToggle } from "./components/BackgroundToggle";
import { isImageFile } from "./utils/imageFormats";

function App() {
  const { setShowContextMenu, openFile, openFolder } = useAppStore();

  useSettings();
  useImageNavigation();
  usePreloader();

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setShowContextMenu(true, { x: e.clientX, y: e.clientY });
    },
    [setShowContextMenu]
  );

  // Handle file association / CLI open
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      unlisten = await listen<string>("open-file", async (event) => {
        const filePath = event.payload;
        if (filePath && typeof filePath === "string") {
          await openFile(filePath);
        }
      });
    };
    setup();
    return () => { if (unlisten) unlisten(); };
  }, [openFile]);

  // Handle drag-drop
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      try {
        unlisten = await listen<{ paths: string[] }>(
          "tauri://drag-drop",
          async (event) => {
            const paths = event.payload.paths;
            if (!paths || paths.length === 0) return;
            const firstPath = paths[0];
            const hasExt = firstPath.lastIndexOf(".") > firstPath.lastIndexOf("/");
            if (!hasExt) {
              await openFolder(firstPath);
            } else if (isImageFile(firstPath)) {
              await openFile(firstPath);
            }
          }
        );
      } catch (e) {
        console.error("Failed to setup drag-drop listener:", e);
      }
    };
    setup();
    return () => { if (unlisten) unlisten(); };
  }, [openFile, openFolder]);

  return (
    <div
      className="w-screen h-screen flex flex-col overflow-hidden relative"
      onContextMenu={handleContextMenu}
    >
      <ImageCanvas />
      <MiniMap />
      <BackgroundToggle />
      <FolderSidebar />
      <ContextMenu />
      <SettingsDialog />
    </div>
  );
}

export default App;
