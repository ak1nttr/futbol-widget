import type { MatchEvent } from "../api/types";

const TZ = "Europe/Istanbul";
const dayFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const isoFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD in Turkey time. */
export const isoDay = (d: Date) => isoFmt.format(d);
export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const fmtTime = (ts: number) => timeFmt.format(ts * 1000);

/** "Bugün", "Yarın", "Dün" or "Paz 19 Eki". */
export function fmtDay(ts: number): string {
  const day = isoDay(new Date(ts * 1000));
  const today = isoDay(new Date());
  if (day === today) return "Bugün";
  if (day === addDays(today, 1)) return "Yarın";
  if (day === addDays(today, -1)) return "Dün";
  return dayFmt.format(ts * 1000);
}

export function fmtDayLong(iso: string): string {
  const today = isoDay(new Date());
  if (iso === today) return "Bugün";
  if (iso === addDays(today, 1)) return "Yarın";
  if (iso === addDays(today, -1)) return "Dün";
  return dayFmt.format(new Date(`${iso}T12:00:00Z`));
}

export const isLive = (e: MatchEvent) => e.status.type === "inprogress";
export const isFinished = (e: MatchEvent) => e.status.type === "finished";

// Sofascore status codes: 6 = 1st half, 7 = 2nd half, 31 = half time,
// 41/42 = extra time halves, 50 = penalties.
export function liveMinute(e: MatchEvent, now = Date.now()): string {
  const c = e.status.code;
  if (c === 31) return "İY";
  if (c === 50) return "Pen.";
  const start = e.time?.currentPeriodStartTimestamp;
  if (!start) return "Canlı";
  const base = c === 6 ? 0 : c === 7 ? 45 : c === 41 ? 90 : c === 42 ? 105 : 0;
  const cap = c === 6 ? 45 : c === 7 ? 90 : c === 41 ? 105 : 120;
  const m = base + Math.floor((now / 1000 - start) / 60) + 1;
  return m > cap ? `${cap}+${m - cap}'` : `${m}'`;
}

export const STATUS_TR: Record<string, string> = {
  postponed: "Ertelendi",
  canceled: "İptal",
  interrupted: "Durduruldu",
};

/** Result from a team's point of view: G (galibiyet), B (beraberlik), M (mağlubiyet). */
export function resultFor(e: MatchEvent, teamId: number): "G" | "B" | "M" | null {
  if (!isFinished(e) || !e.winnerCode) return null;
  if (e.winnerCode === 3) return "B";
  const home = e.homeTeam.id === teamId;
  return (e.winnerCode === 1) === home ? "G" : "M";
}

/** Rating color scale, same thresholds people know from the mobile apps. */
export function ratingClass(r?: number): string {
  if (r == null) return "r-none";
  if (r >= 9) return "r-9";
  if (r >= 8) return "r-8";
  if (r >= 7) return "r-7";
  if (r >= 6.5) return "r-65";
  if (r >= 6) return "r-6";
  return "r-low";
}

export const POSITION_TR: Record<string, string> = { G: "Kaleci", D: "Defans", M: "Orta saha", F: "Forvet" };
