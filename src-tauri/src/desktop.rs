//! Keeps the widget on the desktop layer (behind every app window) and reports
//! when the pointer is over it.

use std::time::Duration;

use tauri::{Emitter, WebviewWindow};
use windows::Win32::Foundation::{HWND, POINT};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, GA_ROOT, GWLP_HWNDPARENT, GetAncestor, GetCursorPos, GetForegroundWindow, HWND_BOTTOM,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SetWindowLongPtrW, SetWindowPos, WindowFromPoint,
};
use windows::core::w;

/// Makes the desktop (Progman) the window's owner. Owned windows stay just above
/// their owner, so together with `alwaysOnBottom` the widget sits on the desktop,
/// under all other windows.
pub fn attach_to_desktop(window: &WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else { return };
    unsafe {
        if let Ok(progman) = FindWindowW(w!("Progman"), None) {
            SetWindowLongPtrW(hwnd, GWLP_HWNDPARENT, progman.0 as isize);
        }
    }
}

/// Moves the window to the bottom of the z-order, just above the desktop.
pub fn send_to_bottom(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            let _ = SetWindowPos(hwnd, Some(HWND_BOTTOM), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }
    }
}

/// The cursor position (screen px) when the topmost window under it is ours,
/// i.e. the widget is visible at that spot and not covered by another window.
fn pointer_over(hwnd: HWND) -> Option<POINT> {
    unsafe {
        let mut p = POINT::default();
        if GetCursorPos(&mut p).is_err() {
            return None;
        }
        (GetAncestor(WindowFromPoint(p), GA_ROOT) == hwnd).then_some(p)
    }
}

/// Converts a screen point to logical px inside the window.
fn to_logical(window: &WebviewWindow, p: POINT) -> Option<(f64, f64)> {
    let pos = window.inner_position().ok()?;
    let scale = window.scale_factor().ok()?;
    Some(((p.x - pos.x) as f64 / scale, (p.y - pos.y) as f64 / scale))
}

/// Polls the cursor and emits `pointer` to the webview: `[x, y]` in logical px
/// while it moves over the widget, `null` when it leaves. The webview works out
/// what is under it (icon, panel or an alert card). Polling avoids relying on
/// WebView2 hover events, which don't arrive reliably for a window that never
/// takes focus.
///
/// Also sends the window back to the bottom whenever it loses focus (clicking
/// the panel brings it to the front, and it should not stay above other apps).
pub fn watch_pointer(window: WebviewWindow) {
    std::thread::spawn(move || {
        let Ok(hwnd) = window.hwnd() else { return };
        let hwnd = hwnd.0 as isize;
        let mut last: Option<POINT> = None;
        let mut was_foreground = false;
        loop {
            std::thread::sleep(Duration::from_millis(80));
            let me = HWND(hwnd as *mut _);
            let over = pointer_over(me);
            if over != last {
                last = over;
                let payload = over.and_then(|p| to_logical(&window, p));
                let _ = window.emit_to(window.label(), "pointer", payload);
            }
            let foreground = unsafe { GetForegroundWindow() } == me;
            if was_foreground && !foreground {
                send_to_bottom(&window);
            }
            was_foreground = foreground;
        }
    });
}
