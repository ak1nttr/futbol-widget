import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** True when running inside the Tauri desktop app (not the browser demo). */
export const isDesktop = "__TAURI_INTERNALS__" in window;

/** Grow the native window to fit the panel, or shrink it back to the icon. */
export function setWindowExpanded(expanded: boolean): Promise<void> {
  return isDesktop ? invoke("set_expanded", { expanded }) : Promise.resolve();
}

/** Subscribes to the app's pointer enter/leave events. Returns an unsubscribe function. */
export function onPointerOver(cb: (over: boolean) => void): () => void {
  if (!isDesktop) return () => {};
  const off = listen<boolean>("pointer", (e) => cb(e.payload));
  return () => void off.then((f) => f());
}
