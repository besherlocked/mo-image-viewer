export interface ImageInfo {
  name: string;
  path: string;
  size: number;
}

export interface FolderInfo {
  name: string;
  path: string;
  image_count: number;
}

export interface ThumbnailData {
  name: string;
  path: string;
  data: string;
}

export interface KeyBindings {
  prev_image: string;
  next_image: string;
  prev_folder: string;
  next_folder: string;
  reset_zoom: string;
  rotate_cw: string;
  rotate_ccw: string;
  flip_h: string;
  flip_v: string;
}

export interface AppSettings {
  pass_through_folders: boolean;
  key_bindings: KeyBindings;
  background: BackgroundMode;
  fit_mode: FitMode;
  sidebar_parent_range: number;
  sidebar_max_children: number;
}

export type FitMode = "contain" | "width" | "height" | "original";
export type BackgroundMode = "dark" | "light" | "gray" | "checkerboard";

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  prev_image: "ArrowLeft",
  next_image: "ArrowRight",
  prev_folder: "ArrowUp",
  next_folder: "ArrowDown",
  reset_zoom: "0",
  rotate_cw: "r",
  rotate_ccw: "Shift+r",
  flip_h: "h",
  flip_v: "v",
};

export const DEFAULT_SETTINGS: AppSettings = {
  pass_through_folders: false,
  key_bindings: DEFAULT_KEY_BINDINGS,
  background: "dark",
  fit_mode: "contain",
  sidebar_parent_range: 1,
  sidebar_max_children: 10,
};
