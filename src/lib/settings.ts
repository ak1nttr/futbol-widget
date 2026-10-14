import { useEffect, useState } from "preact/hooks";

export interface FavTeam {
  id: number;
  name: string;
}

export interface Settings {
  favorites: FavTeam[];
  /** Sofascore unique-tournament ids shown on the "Bugün" tab. */
  leagues: number[];
  /** Pop-up cards for goals, red cards etc. in favorite teams' games. */
  alerts: boolean;
  alertSound: boolean;
}

const KEY = "futbol-widget:settings";

const DEFAULTS: Settings = {
  favorites: [
    { id: 3050, name: "Beşiktaş" },
    { id: 44, name: "Liverpool" },
    { id: 2817, name: "Barcelona" },
    { id: 4700, name: "Türkiye" },
  ],
  // Süper Lig, Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi, Premier League, LaLiga,
  // Türkiye Kupası, Uluslar Ligi, Dünya Kupası + UEFA elemeleri
  leagues: [52, 7, 679, 17015, 17, 8, 96, 10783, 16, 11],
  alerts: true,
  alertSound: true,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable: fall back to defaults */
  }
  return DEFAULTS;
}

let current = load();
const listeners = new Set<(s: Settings) => void>();

export const getSettings = () => current;

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(current));
}

export function useSettings(): Settings {
  const [s, setS] = useState(current);
  useEffect(() => {
    listeners.add(setS);
    return () => void listeners.delete(setS);
  }, []);
  return s;
}
