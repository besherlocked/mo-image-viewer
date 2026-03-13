use crate::models::{is_image_file, FolderInfo, ImageInfo};
use base64::Engine as _;
use image::ImageReader;
use natord::compare as natural_compare;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderLevel {
    pub parent_path: String,
    pub parent_name: String,
    pub folders: Vec<FolderInfo>,
}

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

#[tauri::command]
pub fn list_multi_level_folders(
    current_folder: String,
    parent_range: i32,
    max_children: usize,
) -> Result<Vec<FolderLevel>, String> {
    let current_path = Path::new(&current_folder);
    let parent = current_path
        .parent()
        .ok_or_else(|| "No parent directory for current folder".to_string())?;

    // grandparent 用来枚举“父目录的兄弟们”（如 2023、2024、2025）
    let grandparent = parent.parent().unwrap_or(parent);

    let mut parent_candidates: Vec<_> = fs::read_dir(grandparent)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_dir() {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    parent_candidates.sort_by(|a, b| {
        let an = a.file_name().unwrap_or_default().to_string_lossy().to_string();
        let bn = b.file_name().unwrap_or_default().to_string_lossy().to_string();
        natural_compare(&an, &bn)
    });

    let parent_str = parent.to_string_lossy().to_string();
    let center_idx = parent_candidates
        .iter()
        .position(|p| p.to_string_lossy() == parent_str)
        .ok_or_else(|| "Parent directory not found among its siblings".to_string())?;

    let range = parent_range.max(0) as usize;
    let mut levels: Vec<FolderLevel> = Vec::new();

    let start = center_idx.saturating_sub(range);
    let end = (center_idx + range + 1).min(parent_candidates.len());

    for p in &parent_candidates[start..end] {
        let mut children: Vec<FolderInfo> = fs::read_dir(p)
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

        children.sort_by(|a, b| natural_compare(&a.name, &b.name));
        if max_children > 0 && children.len() > max_children {
            children.truncate(max_children);
        }

        if !children.is_empty() {
            levels.push(FolderLevel {
                parent_path: p.to_string_lossy().to_string(),
                parent_name: p
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
                folders: children,
            });
        }
    }

    Ok(levels)
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

    if ext == "clip" {
        return load_clip_preview(file_path);
    }

    if ext == "pdf" {
        return render_pdf_preview(file_path);
    }

    // For TIFF and other formats: decode via image crate, re-encode as PNG
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

const PNG_SIGNATURE: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const JPEG_SIGNATURE: &[u8] = &[0xFF, 0xD8, 0xFF];

/// SQLite 3 magic header; .clip may have a binary header before this.
const SQLITE_MAGIC: &[u8; 16] = b"SQLite format 3\0";

fn extract_png_from_blob(data: &[u8]) -> Option<&[u8]> {
    data.windows(8)
        .position(|w| w == PNG_SIGNATURE)
        .map(|pos| &data[pos..])
}

fn extract_jpeg_from_blob(data: &[u8]) -> Option<&[u8]> {
    if data.len() >= 3 && data[0..3] == *JPEG_SIGNATURE {
        Some(data)
    } else {
        data.windows(3)
            .position(|w| w == JPEG_SIGNATURE)
            .map(|pos| &data[pos..])
    }
}

/// Collects all byte offsets in `data` where SQLITE_MAGIC appears.
fn find_sqlite_offsets(data: &[u8]) -> Vec<usize> {
    let mut offsets = Vec::new();
    let mut start = 0;
    while start + 16 <= data.len() {
        if let Some(pos) = data[start..].windows(16).position(|w| w == SQLITE_MAGIC) {
            let off = start + pos;
            offsets.push(off);
            start = off + 1;
        } else {
            break;
        }
    }
    offsets
}

/// Opens .clip as SQLite at a given byte offset. Returns (Connection, optional temp file to remove).
fn open_clip_db_at(data: &[u8], offset: usize, temp_path: &Path) -> Result<rusqlite::Connection, String> {
    fs::write(temp_path, &data[offset..]).map_err(|e| format!("Cannot write temp db: {}", e))?;
    rusqlite::Connection::open_with_flags(temp_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("Cannot open .clip database: {}", e))
}

fn load_clip_preview(path: &Path) -> Result<String, String> {
    // Try opening the file directly (whole file is SQLite)
    if let Ok(conn) =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
    {
        if let Ok(result) = run_clip_preview_queries(&conn) {
            return Ok(result);
        }
    }

    let data = fs::read(path).map_err(|e| format!("Cannot read .clip file: {}", e))?;
    let offsets = find_sqlite_offsets(&data);
    if offsets.is_empty() {
        return Err("SQLite database not found in .clip file".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let mut last_err = "No image preview found in .clip file".to_string();

    for (i, &offset) in offsets.iter().enumerate() {
        let temp_path = temp_dir.join(format!(
            "mo_clip_{}_{}_{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos(),
            i
        ));
        match open_clip_db_at(&data, offset, &temp_path) {
            Ok(conn) => {
                let result = run_clip_preview_queries(&conn);
                drop(conn);
                let _ = fs::remove_file(&temp_path);
                if let Ok(img) = result {
                    return Ok(img);
                }
            }
            Err(e) => {
                last_err = e;
            }
        }
    }

    Err(last_err)
}

fn run_clip_preview_queries(conn: &rusqlite::Connection) -> Result<String, String> {
    // Fixed queries for known CLIP Studio Paint table/column names (try first)
    let fixed_queries = [
        "SELECT ImageData FROM CanvasPreview ORDER BY rowid DESC LIMIT 1",
        "SELECT ImageData FROM Thumbnail ORDER BY rowid DESC LIMIT 1",
        "SELECT Data FROM CanvasPreview ORDER BY rowid DESC LIMIT 1",
        "SELECT Data FROM Thumbnail ORDER BY rowid DESC LIMIT 1",
        "SELECT Preview FROM CanvasPreview ORDER BY rowid DESC LIMIT 1",
        "SELECT Preview FROM Thumbnail ORDER BY rowid DESC LIMIT 1",
    ];
    for query in &fixed_queries {
        if let Ok(data) = conn.query_row(query, [], |row| row.get::<_, Vec<u8>>(0)) {
            if let Some(png_data) = extract_png_from_blob(&data) {
                let b64 = base64::engine::general_purpose::STANDARD.encode(png_data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
            if let Some(jpeg_data) = extract_jpeg_from_blob(&data) {
                let b64 = base64::engine::general_purpose::STANDARD.encode(jpeg_data);
                return Ok(format!("data:image/jpeg;base64,{}", b64));
            }
        }
    }

    // Discovery: list all tables and try every BLOB column
    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .and_then(|mut stmt| {
            let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
            rows.collect::<Result<Vec<_>, _>>()
        })
        .unwrap_or_default();

    for table in tables {
        #[derive(Debug)]
        struct ColInfo {
            name: String,
            typ: String,
        }
        let columns: Vec<ColInfo> = conn
            .prepare(&format!("PRAGMA table_info(\"{}\")", table.replace('"', "\"\"")))
            .and_then(|mut stmt| {
                let rows = stmt.query_map([], |row| {
                    Ok(ColInfo {
                        name: row.get::<_, String>(1)?,
                        typ: row.get::<_, String>(2).unwrap_or_default(),
                    })
                })?;
                rows.collect::<Result<Vec<_>, _>>()
            })
            .unwrap_or_default();

        let blob_cols: Vec<String> = columns
            .iter()
            .filter(|c| c.typ.eq_ignore_ascii_case("blob"))
            .map(|c| c.name.clone())
            .collect();

        let table_quoted = format!("\"{}\"", table.replace('"', "\"\""));
        for col in &blob_cols {
            let col_quoted = format!("\"{}\"", col.replace('"', "\"\""));
            let query = format!(
                "SELECT {} FROM {} WHERE {} IS NOT NULL LIMIT 20",
                col_quoted, table_quoted, col_quoted
            );
            let mut stmt = match conn.prepare(&query) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let rows = match stmt.query_map([], |row| row.get::<_, Vec<u8>>(0)) {
                Ok(r) => r,
                Err(_) => continue,
            };
            for row in rows.flatten() {
                if row.len() < 12 {
                    continue;
                }
                if let Some(png_data) = extract_png_from_blob(&row) {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(png_data);
                    return Ok(format!("data:image/png;base64,{}", b64));
                }
                if let Some(jpeg_data) = extract_jpeg_from_blob(&row) {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(jpeg_data);
                    return Ok(format!("data:image/jpeg;base64,{}", b64));
                }
            }
        }
    }

    Err("No image preview found in .clip file".to_string())
}

fn render_pdf_preview(pdf_path: &Path) -> Result<String, String> {
    render_pdf_via_system(pdf_path)
}

#[cfg(target_os = "macos")]
fn render_pdf_via_system(pdf_path: &Path) -> Result<String, String> {
    let pid = std::process::id();
    let temp_dir = std::env::temp_dir().join(format!("mo_pdf_{}", pid));
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Cannot create temp dir: {}", e))?;

    let _output = std::process::Command::new("qlmanage")
        .args(["-t", "-s", "2048", "-o"])
        .arg(&temp_dir)
        .arg(pdf_path)
        // suppress qlmanage's noisy stderr output
        .stderr(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("Cannot run qlmanage: {}", e))?;

    // qlmanage output filename is unpredictable — scan for any PNG in temp dir
    let png_entry = fs::read_dir(&temp_dir)
        .map_err(|e| format!("Cannot read temp dir: {}", e))?
        .filter_map(|e| e.ok())
        .find(|e| {
            e.path()
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x.to_lowercase() == "png")
                .unwrap_or(false)
        });

    let result = if let Some(entry) = png_entry {
        let data = fs::read(entry.path())
            .map_err(|e| format!("Cannot read PDF preview: {}", e))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        Ok(format!("data:image/png;base64,{}", b64))
    } else {
        // Fallback: try sips (simpler macOS image tool)
        render_pdf_via_sips(pdf_path, &temp_dir)
    };

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

#[cfg(target_os = "macos")]
fn render_pdf_via_sips(pdf_path: &Path, temp_dir: &Path) -> Result<String, String> {
    let out_path = temp_dir.join("preview.png");
    let status = std::process::Command::new("sips")
        .args(["-s", "format", "png"])
        .arg(pdf_path)
        .arg("--out")
        .arg(&out_path)
        .stderr(std::process::Stdio::null())
        .status()
        .map_err(|e| format!("Cannot run sips: {}", e))?;

    if status.success() && out_path.exists() {
        let data = fs::read(&out_path)
            .map_err(|e| format!("Cannot read sips output: {}", e))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        Ok(format!("data:image/png;base64,{}", b64))
    } else {
        Err("PDF preview generation failed (tried qlmanage and sips)".to_string())
    }
}

#[cfg(target_os = "windows")]
fn render_pdf_via_system(pdf_path: &Path) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("mo_image_viewer");
    let _ = fs::create_dir_all(&temp_dir);

    let preview_path = temp_dir.join("pdf_preview.png");
    let pdf_str = pdf_path.to_string_lossy().replace('\'', "''");
    let out_str = preview_path.to_string_lossy().replace('\'', "''");

    let ps_script = format!(
        r#"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]

function Await($WinRtTask, $ResultType) {{
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {{ $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' }})[0]
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}}

$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('{pdf_str}')) ([Windows.Storage.StorageFile])
$doc = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($file)) ([Windows.Data.Pdf.PdfDocument])
$page = $doc.GetPage(0)
$stream = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
$null = $page.RenderToStreamAsync($stream).AsTask()
$stream.Seek(0)
$reader = New-Object System.IO.BinaryReader($stream.AsStreamForRead())
$bytes = $reader.ReadBytes($stream.Size)
[System.IO.File]::WriteAllBytes('{out_str}', $bytes)
"#
    );

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
        .output()
        .map_err(|e| format!("Cannot run PowerShell: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("PDF rendering failed: {}", stderr));
    }

    if !preview_path.exists() {
        return Err("PDF preview file not generated".to_string());
    }

    let data =
        fs::read(&preview_path).map_err(|e| format!("Cannot read PDF preview: {}", e))?;
    let _ = fs::remove_file(&preview_path);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", b64))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn render_pdf_via_system(_pdf_path: &Path) -> Result<String, String> {
    Err("PDF preview is not supported on this platform".to_string())
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
        Some("clip") => "application/octet-stream",
        _ => "application/octet-stream",
    }
}

#[tauri::command]
pub fn get_parent_folder(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);
    let parent = path.parent().ok_or("No parent directory")?;
    Ok(parent.to_string_lossy().to_string())
}
