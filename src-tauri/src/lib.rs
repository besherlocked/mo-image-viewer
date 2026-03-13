mod commands;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::filesystem::list_images,
            commands::filesystem::list_sibling_folders,
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
        .setup(|_app| {
            #[cfg(debug_assertions)]
            {
                use tauri::Manager;
                let window = _app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
