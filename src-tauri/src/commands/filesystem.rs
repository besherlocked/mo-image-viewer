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

fn load_clip_preview(path: &Path) -> Result<String, String> {
    let conn = rusqlite::Connection::open_with_flags(
        path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|e| format!("Cannot open .clip file: {}", e))?;

    let queries = [
        "SELECT ImageData FROM CanvasPreview LIMIT 1",
        "SELECT ImageData FROM Thumbnail LIMIT 1",
        "SELECT Data FROM CanvasPreview LIMIT 1",
        "SELECT Data FROM Thumbnail LIMIT 1",
    ];

    for query in &queries {
        if let Ok(data) = conn.query_row(query, [], |row| row.get::<_, Vec<u8>>(0)) {
            if !data.is_empty() {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                return Ok(format!("data:image/png;base64,{}", b64));
            }
        }
    }

    Err("No preview image found in .clip file".to_string())
}

fn render_pdf_preview(pdf_path: &Path) -> Result<String, String> {
    render_pdf_via_system(pdf_path)
}

#[cfg(target_os = "macos")]
fn render_pdf_via_system(pdf_path: &Path) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("mo_image_viewer");
    let _ = fs::create_dir_all(&temp_dir);

    let output = std::process::Command::new("qlmanage")
        .args(["-t", "-s", "4096", "-o"])
        .arg(&temp_dir)
        .arg(pdf_path)
        .output()
        .map_err(|e| format!("Cannot run qlmanage: {}", e))?;

    if !output.status.success() {
        return Err("qlmanage failed to generate PDF preview".to_string());
    }

    let fname = pdf_path
        .file_name()
        .ok_or("Invalid filename")?
        .to_string_lossy();
    let preview_path = temp_dir.join(format!("{}.png", fname));

    if !preview_path.exists() {
        return Err("PDF preview file not generated".to_string());
    }

    let data =
        fs::read(&preview_path).map_err(|e| format!("Cannot read PDF preview: {}", e))?;
    let _ = fs::remove_file(&preview_path);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:image/png;base64,{}", b64))
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
