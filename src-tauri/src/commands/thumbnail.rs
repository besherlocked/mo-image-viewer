use crate::models::ThumbnailData;
use base64::Engine as _;
use image::imageops::FilterType;
use image::ImageReader;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

fn get_cache_dir() -> PathBuf {
    let mut dir = std::env::temp_dir();
    dir.push("mo-image-viewer-thumbs");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

fn hash_path(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hex::encode(hasher.finalize())[..16].to_string()
}

fn get_cached_thumbnail(original_path: &str) -> Option<Vec<u8>> {
    let cache_path = get_cache_dir().join(format!("{}.jpg", hash_path(original_path)));
    if !cache_path.exists() {
        return None;
    }

    let original_modified = fs::metadata(original_path)
        .and_then(|m| m.modified())
        .ok()?;
    let cache_modified = fs::metadata(&cache_path)
        .and_then(|m| m.modified())
        .ok()?;

    if cache_modified >= original_modified {
        fs::read(&cache_path).ok()
    } else {
        None
    }
}

fn generate_and_cache_thumbnail(original_path: &str, size: u32) -> Result<Vec<u8>, String> {
    let img = ImageReader::open(original_path)
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;

    let thumb = img.resize(size, size, FilterType::Triangle);

    let mut buf = Vec::new();
    thumb
        .write_to(
            &mut Cursor::new(&mut buf),
            image::ImageFormat::Jpeg,
        )
        .map_err(|e| e.to_string())?;

    let cache_path = get_cache_dir().join(format!("{}.jpg", hash_path(original_path)));
    let _ = fs::write(&cache_path, &buf);

    Ok(buf)
}

#[tauri::command]
pub fn get_thumbnails(folder: String, size: u32) -> Result<Vec<ThumbnailData>, String> {
    let dir_path = Path::new(&folder);
    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {}", folder));
    }

    let mut thumbnails = Vec::new();
    let mut entries: Vec<_> = fs::read_dir(dir_path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let p = e.path();
            p.is_file() && crate::models::is_image_file(&p)
        })
        .collect();

    entries.sort_by(|a, b| {
        natord::compare(
            &a.file_name().to_string_lossy(),
            &b.file_name().to_string_lossy(),
        )
    });

    let max_thumbs = 20;
    for entry in entries.into_iter().take(max_thumbs) {
        let file_path = entry.path();
        let path_str = file_path.to_string_lossy().to_string();

        let data = if let Some(cached) = get_cached_thumbnail(&path_str) {
            cached
        } else {
            match generate_and_cache_thumbnail(&path_str, size) {
                Ok(d) => d,
                Err(_) => continue,
            }
        };

        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        thumbnails.push(ThumbnailData {
            name: file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            path: path_str,
            data: format!("data:image/jpeg;base64,{}", b64),
        });
    }

    Ok(thumbnails)
}
