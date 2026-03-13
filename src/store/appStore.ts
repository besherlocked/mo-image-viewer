import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  ImageInfo,
  FolderInfo,
  AppSettings,
  FitMode,
  BackgroundMode,
} from "../types";
import { DEFAULT_SETTINGS } from "../types";

interface AppState {
  currentFolder: string;
  images: ImageInfo[];
  currentIndex: number;
  currentImageData: string;

  zoom: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  panX: number;
  panY: number;

  fitMode: FitMode;
  background: BackgroundMode;
  isFullscreen: boolean;

  settings: AppSettings;
  siblingFolders: FolderInfo[];

  preloadCache: Record<number, string>;

  showContextMenu: boolean;
  contextMenuPos: { x: number; y: number };
  showSettings: boolean;

  loading: boolean;

  openFolder: (folder: string, startIndex?: number) => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  goToImage: (index: number) => Promise<void>;
  nextImage: () => Promise<void>;
  prevImage: () => Promise<void>;
  nextFolder: () => Promise<void>;
  prevFolder: () => Promise<void>;
  preloadAround: (index: number) => void;

  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  resetView: () => void;
  setRotation: (rotation: number) => void;
  rotateCW: () => void;
  rotateCCW: () => void;
  toggleFlipH: () => void;
  toggleFlipV: () => void;
  setPan: (x: number, y: number) => void;

  setFitMode: (mode: FitMode) => void;
  setBackground: (bg: BackgroundMode) => void;
  cycleBackground: () => void;
  toggleFullscreen: () => Promise<void>;

  loadSettings: () => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  setShowContextMenu: (
    show: boolean,
    pos?: { x: number; y: number }
  ) => void;
  setShowSettings: (show: boolean) => void;
}

const BACKGROUNDS: BackgroundMode[] = ["dark", "light", "gray", "checkerboard"];

export const useAppStore = create<AppState>((set, get) => ({
  currentFolder: "",
  images: [],
  currentIndex: 0,
  currentImageData: "",

  zoom: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
  panX: 0,
  panY: 0,

  fitMode: "contain",
  background: "dark",
  isFullscreen: false,

  settings: DEFAULT_SETTINGS,
  siblingFolders: [],

  preloadCache: {},

  showContextMenu: false,
  contextMenuPos: { x: 0, y: 0 },
  showSettings: false,

  loading: false,

  preloadAround: (index: number) => {
    const { images, preloadCache } = get();
    const range = 3;

    const newCache: Record<number, string> = {};
    for (const [key, value] of Object.entries(preloadCache)) {
      const k = Number(key);
      if (Math.abs(k - index) <= range + 2) {
        newCache[k] = value;
      }
    }
    set({ preloadCache: newCache });

    for (let offset = 1; offset <= range; offset++) {
      for (const i of [index + offset, index - offset]) {
        if (i >= 0 && i < images.length && !newCache[i]) {
          invoke<string>("get_image_base64", { path: images[i].path })
            .then((data) => {
              set((s) => ({
                preloadCache: { ...s.preloadCache, [i]: data },
              }));
            })
            .catch(() => {});
        }
      }
    }
  },

  openFolder: async (folder: string, startIndex = 0) => {
    set({ loading: true });
    try {
      const images = await invoke<ImageInfo[]>("list_images", { folder });
      const siblingFolders = await invoke<FolderInfo[]>(
        "list_sibling_folders",
        { folder }
      );

      if (images.length === 0) {
        set({
          currentFolder: folder,
          images: [],
          currentIndex: 0,
          currentImageData: "",
          siblingFolders,
          loading: false,
        });
        return;
      }

      const idx = Math.min(startIndex, images.length - 1);
      const imageData = await invoke<string>("get_image_base64", {
        path: images[idx].path,
      });

      set({
        currentFolder: folder,
        images,
        currentIndex: idx,
        currentImageData: imageData,
        siblingFolders,
        zoom: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
        panX: 0,
        panY: 0,
        preloadCache: { [idx]: imageData },
        loading: false,
      });

      invoke("set_window_title", {
        title: `Mo图 - ${images[idx].name}`,
      }).catch(() => {});

      get().preloadAround(idx);
    } catch (e) {
      console.error("Failed to open folder:", e);
      set({ loading: false });
    }
  },

  openFile: async (filePath: string) => {
    try {
      const folder = await invoke<string>("get_parent_folder", { filePath });
      const images = await invoke<ImageInfo[]>("list_images", { folder });
      const idx = images.findIndex((img) => img.path === filePath);
      await get().openFolder(folder, idx >= 0 ? idx : 0);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  },

  goToImage: async (index: number) => {
    const { images, preloadCache } = get();
    if (index < 0 || index >= images.length) return;

    set({ loading: true });

    try {
      let imageData = preloadCache[index];
      if (!imageData) {
        imageData = await invoke<string>("get_image_base64", {
          path: images[index].path,
        });
      }

      set({
        currentIndex: index,
        currentImageData: imageData,
        zoom: 1,
        rotation: 0,
        flipH: false,
        flipV: false,
        panX: 0,
        panY: 0,
        loading: false,
      });

      invoke("set_window_title", {
        title: `Mo图 - ${images[index].name}`,
      }).catch(() => {});

      get().preloadAround(index);
    } catch (e) {
      console.error("Failed to load image:", e);
      set({ loading: false });
    }
  },

  nextImage: async () => {
    const { currentIndex, images, settings, siblingFolders, currentFolder } =
      get();
    if (currentIndex < images.length - 1) {
      await get().goToImage(currentIndex + 1);
    } else if (settings.pass_through_folders) {
      const folderIdx = siblingFolders.findIndex(
        (f) => f.path === currentFolder
      );
      if (folderIdx >= 0 && folderIdx < siblingFolders.length - 1) {
        await get().openFolder(siblingFolders[folderIdx + 1].path, 0);
      }
    }
  },

  prevImage: async () => {
    const { currentIndex, settings, siblingFolders, currentFolder } = get();
    if (currentIndex > 0) {
      await get().goToImage(currentIndex - 1);
    } else if (settings.pass_through_folders) {
      const folderIdx = siblingFolders.findIndex(
        (f) => f.path === currentFolder
      );
      if (folderIdx > 0) {
        const prevFolder = siblingFolders[folderIdx - 1];
        await get().openFolder(prevFolder.path, prevFolder.image_count - 1);
      }
    }
  },

  nextFolder: async () => {
    const { siblingFolders, currentFolder } = get();
    const idx = siblingFolders.findIndex((f) => f.path === currentFolder);
    if (idx >= 0 && idx < siblingFolders.length - 1) {
      await get().openFolder(siblingFolders[idx + 1].path, 0);
    }
  },

  prevFolder: async () => {
    const { siblingFolders, currentFolder } = get();
    const idx = siblingFolders.findIndex((f) => f.path === currentFolder);
    if (idx > 0) {
      await get().openFolder(siblingFolders[idx - 1].path, 0);
    }
  },

  setZoom: (zoom: number) =>
    set({ zoom: Math.max(0.05, Math.min(8, zoom)) }),
  zoomBy: (factor: number) =>
    set((s) => ({ zoom: Math.max(0.05, Math.min(8, s.zoom * factor)) })),
  resetView: () =>
    set({ zoom: 1, rotation: 0, flipH: false, flipV: false, panX: 0, panY: 0 }),
  setRotation: (rotation: number) => set({ rotation }),
  rotateCW: () => set((s) => ({ rotation: (s.rotation + 90) % 360 })),
  rotateCCW: () => set((s) => ({ rotation: (s.rotation + 270) % 360 })),
  toggleFlipH: () => set((s) => ({ flipH: !s.flipH })),
  toggleFlipV: () => set((s) => ({ flipV: !s.flipV })),
  setPan: (x: number, y: number) => set({ panX: x, panY: y }),

  setFitMode: (mode: FitMode) => {
    set({ fitMode: mode, zoom: 1, panX: 0, panY: 0 });
  },

  setBackground: (bg: BackgroundMode) => set({ background: bg }),
  cycleBackground: () =>
    set((s) => {
      const idx = BACKGROUNDS.indexOf(s.background);
      return { background: BACKGROUNDS[(idx + 1) % BACKGROUNDS.length] };
    }),

  toggleFullscreen: async () => {
    try {
      const result = await invoke<boolean>("toggle_fullscreen");
      set({ isFullscreen: result });
    } catch (e) {
      console.error("Failed to toggle fullscreen:", e);
    }
  },

  loadSettings: async () => {
    try {
      const settings = await invoke<AppSettings>("load_settings");
      set({
        settings,
        background: settings.background as BackgroundMode,
        fitMode: settings.fit_mode as FitMode,
      });
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  },

  saveSettings: async (settings: AppSettings) => {
    try {
      await invoke("save_settings", { settings });
      set({
        settings,
        background: settings.background as BackgroundMode,
        fitMode: settings.fit_mode as FitMode,
      });
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  },

  setShowContextMenu: (show, pos) =>
    set({
      showContextMenu: show,
      ...(pos ? { contextMenuPos: pos } : {}),
    }),

  setShowSettings: (show: boolean) => set({ showSettings: show }),
}));
