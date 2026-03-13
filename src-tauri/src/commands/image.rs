use base64::Engine as _;
use image::{DynamicImage, ImageFormat, ImageReader};
use std::io::Cursor;
use std::path::Path;

fn load_image(path: &str) -> Result<DynamicImage, String> {
    ImageReader::open(path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {}", e))
}

fn image_to_base64(img: &DynamicImage, original_path: &str) -> Result<String, String> {
    let format = guess_output_format(original_path);
    let mut buf = Vec::new();
    img.write_to(&mut Cursor::new(&mut buf), format)
        .map_err(|e| format!("Failed to encode image: {}", e))?;

    let mime = format_to_mime(format);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}

fn guess_output_format(path: &str) -> ImageFormat {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|ext| match ext.to_lowercase().as_str() {
            "png" => ImageFormat::Png,
            "gif" => ImageFormat::Gif,
            "bmp" => ImageFormat::Bmp,
            "webp" => ImageFormat::WebP,
            "tiff" | "tif" => ImageFormat::Tiff,
            "ico" => ImageFormat::Ico,
            _ => ImageFormat::Png,
        })
        .unwrap_or(ImageFormat::Png)
}

fn format_to_mime(format: ImageFormat) -> &'static str {
    match format {
        ImageFormat::Jpeg => "image/jpeg",
        ImageFormat::Png => "image/png",
        ImageFormat::Gif => "image/gif",
        ImageFormat::Bmp => "image/bmp",
        ImageFormat::WebP => "image/webp",
        ImageFormat::Tiff => "image/tiff",
        ImageFormat::Ico => "image/x-icon",
        _ => "image/png",
    }
}

#[tauri::command]
pub fn rotate_image(path: String, degrees: u16) -> Result<String, String> {
    let img = load_image(&path)?;
    let rotated = match degrees {
        90 => img.rotate90(),
        180 => img.rotate180(),
        270 => img.rotate270(),
        _ => return Err(format!("Invalid rotation degrees: {}", degrees)),
    };
    image_to_base64(&rotated, &path)
}

#[tauri::command]
pub fn flip_image(path: String, direction: String) -> Result<String, String> {
    let img = load_image(&path)?;
    let flipped = match direction.as_str() {
        "horizontal" => img.fliph(),
        "vertical" => img.flipv(),
        _ => return Err(format!("Invalid flip direction: {}", direction)),
    };
    image_to_base64(&flipped, &path)
}
