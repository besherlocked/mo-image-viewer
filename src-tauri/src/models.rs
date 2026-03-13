use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderInfo {
    pub name: String,
    pub path: String,
    pub image_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailData {
    pub name: String,
    pub path: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyBindings {
    pub prev_image: String,
    pub next_image: String,
    pub prev_folder: String,
    pub next_folder: String,
    pub reset_zoom: String,
    pub rotate_cw: String,
    pub rotate_ccw: String,
    pub flip_h: String,
    pub flip_v: String,
}

impl Default for KeyBindings {
    fn default() -> Self {
        Self {
            prev_image: "ArrowLeft".to_string(),
            next_image: "ArrowRight".to_string(),
            prev_folder: "ArrowUp".to_string(),
            next_folder: "ArrowDown".to_string(),
            reset_zoom: "0".to_string(),
            rotate_cw: "r".to_string(),
            rotate_ccw: "Shift+r".to_string(),
            flip_h: "h".to_string(),
            flip_v: "v".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub pass_through_folders: bool,
    pub key_bindings: KeyBindings,
    pub background: String,
    pub fit_mode: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            pass_through_folders: false,
            key_bindings: KeyBindings::default(),
            background: "dark".to_string(),
            fit_mode: "contain".to_string(),
        }
    }
}

pub const IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "svg", "avif", "ico", "heic",
    "heif",
];

pub fn is_image_file(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| IMAGE_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}
