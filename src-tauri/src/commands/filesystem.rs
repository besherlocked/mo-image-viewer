use crate::models::{is_image_file, FolderInfo, ImageInfo};
use base64::Engine as _;
use image::ImageReader;
use natord::compare as natural_compare;
use std::fs;
use std::io::Cursor;
use std::path::Path;

#[tauri::command]
pub fn list_images(folder: String) -> Result<Vec<ImageInfo>, String> {
    let path = Path::new(&folder);
    if !path.is_dir() {
        return Err(format!("Not a directory: {}", folder));
    }

    let mut images: Vec<ImageInfo> = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let file_path = entry.path();
            if file_path.is_file() && is_image_file(&file_path) {
                let metadata = entry.metadata().ok()?;
                Some(ImageInfo {
                    name: file_path.file_name()?.to_string_lossy().to_string(),
                    path: file_path.to_string_lossy().to_string(),
                    size: metadata.len(),
                })
            } else {
                None
            }
        })
        .collect();

    images.sort_by(|a, b| natural_compare(&a.name, &b.name));
    Ok(images)
}

#[tauri::command]
pub fn list_sibling_folders(folder: String) -> Result<Vec<FolderInfo>, String> {
    let path = Path::new(&folder);
    let parent = path.parent().ok_or("No parent directory")?;

    let mut folders: Vec<FolderInfo> = fs::read_dir(parent)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let dir_path = entry.path();
            if dir_path.is_dir() {
                let image_count = count_images_in_dir(&dir_path);
                if image_count > 0 {
                    Some(FolderInfo {
                        name: dir_path.file_name()?.to_string_lossy().to_string(),
                        path: dir_path.to_string_lossy().to_string(),
                        image_count,
                    })
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect();

    folders.sort_by(|a, b| natural_compare(&a.name, &b.name));
    Ok(folders)
}

fn count_images_in_dir(dir: &Path) -> usize {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    p.is_file() && is_image_file(&p)
                })
                .count()
        })
        .unwrap_or(0)
}

#[tauri::command]
pub fn get_image_base64(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("File not found: {}", path));
    }

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    // Formats the browser can render directly
    let browser_native = matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "svg" | "avif" | "ico"
    );

    if browser_native {
        let data = fs::read(file_path).map_err(|e| e.to_string())?;
        let mime = mime_from_extension(file_path);
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        return Ok(format!("data:{};base64,{}", mime, b64));
    }

    // For PSD, TIFF, and other formats: decode via image crate, re-encode as PNG
    let img = ImageReader::open(file_path)
        .map_err(|e| format!("Cannot open {}: {}", path, e))?
        .with_guessed_format()
        .map_err(|e| format!("Cannot detect format: {}", e))?
        .decode()
        .map_err(|e| format!("Cannot decode {}: {}", path, e))?;

    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Png)
        .map_err(|e| format!("Cannot encode as PNG: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:image/png;base64,{}", b64))
}

fn mime_from_extension(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("webp") => "image/webp",
        Some("tiff" | "tif") => "image/tiff",
        Some("svg") => "image/svg+xml",
        Some("avif") => "image/avif",
        Some("ico") => "image/x-icon",
        Some("heic" | "heif") => "image/heic",
        Some("psd") => "image/vnd.adobe.photoshop",
        Some("pdf") => "application/pdf",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub fn get_parent_folder(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    let parent = path.parent().ok_or("No parent directory")?;
    Ok(parent.to_string_lossy().to_string())
}
