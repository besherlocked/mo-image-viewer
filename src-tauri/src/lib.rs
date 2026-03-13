mod commands;
mod models;

use tauri::Emitter;
#[cfg(debug_assertions)]
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::filesystem::list_images,
            commands::filesystem::list_sibling_folders,
            commands::filesystem::list_multi_level_folders,
            commands::filesystem::get_image_base64,
            commands::filesystem::get_parent_folder,
            commands::image::rotate_image,
            commands::image::flip_image,
            commands::thumbnail::get_thumbnails,
            commands::config::load_settings,
            commands::config::save_settings,
            commands::window::toggle_fullscreen,
            commands::window::set_fullscreen,
            commands::window::set_window_title,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let file_path = args[1].clone();
                let path = std::path::Path::new(&file_path);
                if path.exists() && path.is_file() {
                    let handle = app.handle().clone();
                    tauri::async_runtime::spawn(async move {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = handle.emit("open-file", file_path);
                    });
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        if let Some(path_str) = path.to_str() {
                            let _ = _app.emit("open-file", path_str.to_string());
                        }
                    }
                }
            }
        });
}
