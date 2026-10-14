import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** True when running inside the Tauri desktop app (not the browser demo). */
export const isDesktop = "__TAURI_INTERNALS__" in window;

/**
 * Resizes the native window: to fit the panel, to a given size (alert cards
 * under the icon, in logical px), or back to just the icon (`null`).
 */
export function setWindowLayout(layout: "panel" | { width: number; height: number } | null): Promise<void> {
  if (!isDesktop) return Promise.resolve();
  const size = layout === "panel" || !layout ? { width: 0, height: 0 } : layout;
  return invoke("set_layout", { panel: layout === "panel", ...size });
}

export type PointerPos = { x: number; y: number } | null;

/**
 * Subscribes to the pointer position over the window (logical px), or `null`
 * when it leaves. Returns an unsubscribe function.
 */
export function onPointerMove(cb: (p: PointerPos) => void): () => void {
  if (!isDesktop) return () => {};
  const off = listen<[number, number] | null>("pointer", (e) => cb(e.payload && { x: e.payload[0], y: e.payload[1] }));
  return () => void off.then((f) => f());
}
