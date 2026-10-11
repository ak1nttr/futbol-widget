mod desktop;
mod sofa;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

use sofa::Sofa;

/// Logical sizes of the window: just the round icon, or icon + panel.
const COLLAPSED: (f64, f64) = (76.0, 76.0);
const EXPANDED_W: f64 = 384.0;
const EXPANDED_MAX_H: f64 = 680.0;
/// Gap between the window and the screen's top-right corner.
const MARGIN: f64 = 6.0;

/// Pins the window to the top-right corner of the work area (screen minus taskbar)
/// and resizes it. The webview calls this when the pointer enters or leaves.
fn place(window: &WebviewWindow, expanded: bool) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) else {
        return Ok(());
    };
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let (w, h) = if expanded {
        let max_h = area.size.height as f64 / scale - 2.0 * MARGIN;
        (EXPANDED_W, EXPANDED_MAX_H.min(max_h))
    } else {
        COLLAPSED
    };
    let (pw, ph) = ((w * scale).round() as u32, (h * scale).round() as u32);
    let x = area.position.x + area.size.width as i32 - pw as i32 - (MARGIN * scale) as i32;
    let y = area.position.y + (MARGIN * scale) as i32;
    window.set_size(PhysicalSize::new(pw, ph))?;
    window.set_position(PhysicalPosition::new(x, y))?;
    Ok(())
}

#[tauri::command]
fn set_expanded(window: WebviewWindow, expanded: bool) -> Result<(), String> {
    place(&window, expanded).map_err(|e| e.to_string())
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = place(&w, false);
        let _ = w.show();
        desktop::send_to_bottom(&w);
    }
}

fn toggle_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_main(app);
        }
    }
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let autostart = app.autolaunch();
    let toggle = MenuItem::with_id(app, "toggle", "Göster / Gizle", true, None::<&str>)?;
    let startup = CheckMenuItem::with_id(
        app,
        "startup",
        "Bilgisayar açılınca başlat",
        true,
        autostart.is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Kapat", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &startup, &PredefinedMenuItem::separator(app)?, &quit])?;

    let startup_item = startup.clone();
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().expect("app icon"))
        .tooltip("Futbol Widget")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "toggle" => toggle_main(app),
            "startup" => {
                let al = app.autolaunch();
                let enable = !al.is_enabled().unwrap_or(false);
                let _ = if enable { al.enable() } else { al.disable() };
                let _ = startup_item.set_checked(al.is_enabled().unwrap_or(false));
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                toggle_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

/// Turn autostart on the first time the app runs; after that the tray checkbox decides.
fn init_autostart(app: &AppHandle) {
    let Ok(dir) = app.path().app_config_dir() else { return };
    let marker = dir.join("autostart-initialized");
    if marker.exists() {
        return;
    }
    if app.autolaunch().enable().is_ok() {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(marker, b"1");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(Sofa::default())
        .register_asynchronous_uri_scheme_protocol("sofa", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let path = request
                .uri()
                .path_and_query()
                .map(|p| p.as_str().trim_start_matches('/').to_string())
                .unwrap_or_default();
            tauri::async_runtime::spawn_blocking(move || {
                responder.respond(app.state::<Sofa>().respond(&path));
            });
        })
        .invoke_handler(tauri::generate_handler![set_expanded])
        .setup(|app| {
            let handle = app.handle();
            if !cfg!(debug_assertions) {
                init_autostart(handle);
            }
            setup_tray(handle)?;
            if let Some(w) = app.get_webview_window("main") {
                desktop::attach_to_desktop(&w);
                desktop::watch_pointer(w);
            }
            show_main(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
