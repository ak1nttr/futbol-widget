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

/// True when the topmost window under the cursor is ours, i.e. the widget is
/// visible at that spot and not covered by another window.
fn pointer_over(hwnd: HWND) -> bool {
    unsafe {
        let mut p = POINT::default();
        if GetCursorPos(&mut p).is_err() {
            return false;
        }
        GetAncestor(WindowFromPoint(p), GA_ROOT) == hwnd
    }
}

/// Polls the cursor and emits `pointer` (true/false) to the webview when it
/// enters or leaves the widget. Polling avoids relying on WebView2 hover events,
/// which don't arrive reliably for a window that never takes focus.
///
/// Also sends the window back to the bottom whenever it loses focus (clicking
/// the panel brings it to the front, and it should not stay above other apps).
pub fn watch_pointer(window: WebviewWindow) {
    std::thread::spawn(move || {
        let Ok(hwnd) = window.hwnd() else { return };
        let hwnd = hwnd.0 as isize;
        let mut was_over = false;
        let mut was_foreground = false;
        loop {
            std::thread::sleep(Duration::from_millis(80));
            let me = HWND(hwnd as *mut _);
            let over = pointer_over(me);
            if over != was_over {
                was_over = over;
                let _ = window.emit_to(window.label(), "pointer", over);
            }
            let foreground = unsafe { GetForegroundWindow() } == me;
            if was_foreground && !foreground {
                send_to_bottom(&window);
            }
            was_foreground = foreground;
        }
    });
}
