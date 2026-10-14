import { useEffect, useRef, useState } from "preact/hooks";
import { getIncidents, getLastEvents, getNextEvents } from "../api/sofascore";
import type { Incident, MatchEvent } from "../api/types";
import { isFinished, isLive, resultFor } from "./format";
import { getSettings, useSettings } from "./settings";
import { playAlertSound } from "./sound";
import { useData } from "./useData";

export type AlertKind = "goal" | "goalAgainst" | "red" | "penalty" | "penaltyMissed" | "goalCancelled" | "start" | "end";

export interface MatchAlert {
  /** Unique per match and incident, e.g. "123:goal:456". */
  key: string;
  kind: AlertKind;
  /** The match as it was when the alert fired. */
  event: MatchEvent;
  title: string;
  detail?: string;
  minute?: string;
  score: [number, number];
  /** Side whose score just changed, so the card can animate that digit. */
  scored?: "home" | "away";
}

// ---------- store ----------

let alerts: MatchAlert[] = [];
const listeners = new Set<(a: MatchAlert[]) => void>();
const emit = () => listeners.forEach((l) => l(alerts));

/** When several things happen in one poll, the chime of the most important one plays. */
const PRIORITY: AlertKind[] = ["goal", "goalAgainst", "red", "goalCancelled", "penalty", "penaltyMissed", "end", "start"];

/** Adds alerts in the order they happened (newest ends up on top) and plays one chime. */
export function pushAlerts(list: MatchAlert[]) {
  const s = getSettings();
  const fresh = list.filter((a) => !alerts.some((x) => x.key === a.key));
  if (!s.alerts || !fresh.length) return;
  alerts = [...fresh.reverse(), ...alerts];
  emit();
  if (s.alertSound) {
    const kind = PRIORITY.find((k) => fresh.some((a) => a.kind === k));
    if (kind) playAlertSound(kind);
  }
}

export function dismissAlert(key: string) {
  alerts = alerts.filter((a) => a.key !== key);
  emit();
}

export function clearAlerts() {
  alerts = [];
  emit();
}

export function useAlerts(): MatchAlert[] {
  const [a, setA] = useState(alerts);
  useEffect(() => {
    listeners.add(setA);
    setA(alerts); // in case something was pushed before this subscribed
    return () => void listeners.delete(setA);
  }, []);
  return a;
}

// ---------- building alerts from match data ----------

const display = (s: { display?: number }) => s.display ?? 0;
const teamName = (e: MatchEvent, home: boolean) => {
  const t = home ? e.homeTeam : e.awayTeam;
  return t.shortName ?? t.name;
};

function minute(i: Incident): string | undefined {
  if (i.time == null) return undefined;
  return i.addedTime && i.addedTime < 999 ? `${i.time}+${i.addedTime}'` : `${i.time}'`;
}

const MISS_REASON: Record<string, string> = {
  goalkeeperSave: "Kaleci kurtardı",
  woodwork: "Direkten döndü",
  hitWoodwork: "Direkten döndü",
  missed: "Auta gitti",
};

type Draft = Omit<MatchAlert, "event" | "score"> & { score?: [number, number] };

/** `favSides`: which side(s) of the match are favorite teams. */
function incidentAlert(e: MatchEvent, i: Incident, favSides: Set<"home" | "away">): Draft | null {
  if (i.id == null) return null;
  const side = i.isHome ? "home" : "away";
  const team = teamName(e, !!i.isHome);
  const player = i.player?.shortName ?? i.playerName ?? "";
  const base = { key: `${e.id}:${i.incidentType}:${i.id}`, minute: minute(i) };

  switch (i.incidentType) {
    case "goal": {
      const ours = favSides.has(side);
      const how = i.incidentClass === "penalty" ? " (penaltı)" : i.incidentClass === "ownGoal" ? " (kendi kalesine)" : "";
      return {
        ...base,
        kind: ours ? "goal" : "goalAgainst",
        title: ours ? `GOL! ${team}` : `Gol · ${team}`,
        detail: player + how,
        score: i.homeScore != null && i.awayScore != null ? [i.homeScore, i.awayScore] : undefined,
        scored: side,
      };
    }
    case "card":
      if (i.rescinded || (i.incidentClass !== "red" && i.incidentClass !== "yellowRed")) return null;
      return {
        ...base,
        kind: "red",
        title: i.incidentClass === "yellowRed" ? "İkinci sarıdan kırmızı" : "Kırmızı kart",
        detail: player ? `${player} · ${team}` : team,
      };
    case "inGamePenalty":
      if (i.incidentClass !== "missed") return null;
      return {
        ...base,
        kind: "penaltyMissed",
        title: `Penaltı kaçtı · ${team}`,
        detail: [player, i.reason && MISS_REASON[i.reason]].filter(Boolean).join(" · "),
      };
    case "varDecision":
      if (i.incidentClass === "penaltyAwarded") return { ...base, kind: "penalty", title: `Penaltı · ${team}`, detail: "VAR kararıyla verildi" };
      if (i.incidentClass === "goalNotAwarded")
        return { ...base, kind: "goalCancelled", title: `Gol iptal · ${team}`, detail: player ? `VAR · ${player}` : "VAR kararı" };
      return null;
    default:
      return null;
  }
}

const RESULT_TR = { G: "Galibiyet", B: "Beraberlik", M: "Mağlubiyet" };

function statusAlerts(e: MatchEvent, favIds: number[]): { start: Draft[]; end: Draft[] } {
  const start: Draft[] = [];
  const end: Draft[] = [];
  if (isLive(e) || isFinished(e))
    start.push({ key: `${e.id}:start`, kind: "start", title: "Maç başladı", detail: e.tournament.uniqueTournament?.name ?? e.tournament.name });
  if (isFinished(e)) {
    // Only say who won when exactly one side is a favorite.
    const r = favIds.length === 1 ? resultFor(e, favIds[0]) : null;
    end.push({ key: `${e.id}:end`, kind: "end", title: "Maç bitti", detail: r ? RESULT_TR[r] : undefined });
  }
  return { start, end };
}

// ---------- watcher ----------

const FAST = 20_000;
const SLOW = 5 * 60_000;
/** Poll quickly from this long before kick-off, to catch the start. */
const SOON = 15 * 60;
/** Finished games stay interesting this long after kick-off (to catch the final whistle). */
const RECENT = 4 * 60 * 60;

/**
 * Alerts already known per match. A match seen for the first time in this
 * session only records what has happened so far, so starting the app
 * mid-match doesn't replay old goals.
 */
const known = new Map<number, Set<string>>();
const lastStatus = new Map<number, string>();

async function poll(favIds: number[], ttl: number): Promise<{ live?: MatchEvent; fast: boolean }> {
  const lists = await Promise.all(favIds.map((id) => Promise.all([getNextEvents(id, ttl), getLastEvents(id, ttl)])));
  const now = Date.now() / 1000;

  let live: MatchEvent | undefined;
  let fast = false;
  const matches = new Map<number, { e: MatchEvent; favIds: number[] }>();
  lists.forEach(([next, last], idx) => {
    for (const e of [...last, ...next]) {
      const relevant =
        isLive(e) ||
        (e.status.type === "notstarted" && e.startTimestamp - now < SOON) ||
        (isFinished(e) && now - e.startTimestamp < RECENT);
      if (!relevant) continue;
      if (isLive(e)) live ??= e;
      if (!isFinished(e)) fast = true;
      const m = matches.get(e.id) ?? { e, favIds: [] };
      m.favIds.push(favIds[idx]);
      matches.set(e.id, m);
    }
  });

  const out: MatchAlert[] = [];
  for (const { e, favIds: ids } of matches.values()) {
    const wasLive = lastStatus.get(e.id) === "inprogress";
    lastStatus.set(e.id, e.status.type);
    // Incidents are needed while the game runs, plus once more right after it ends
    // (for anything that happened since the previous poll).
    const incidents = isLive(e) || (isFinished(e) && wasLive) ? await getIncidents(e.id).catch(() => [] as Incident[]) : [];

    const favSides = new Set<"home" | "away">();
    if (ids.includes(e.homeTeam.id)) favSides.add("home");
    if (ids.includes(e.awayTeam.id)) favSides.add("away");

    const { start, end } = statusAlerts(e, ids);
    // Sofascore lists incidents newest first.
    const fromIncidents = [...incidents].reverse().flatMap((i) => incidentAlert(e, i, favSides) ?? []);
    const drafts = [...start, ...fromIncidents, ...end];

    const seen = known.get(e.id);
    if (!seen) {
      known.set(e.id, new Set(drafts.map((d) => d.key)));
      continue;
    }
    for (const d of drafts) {
      if (seen.has(d.key)) continue;
      seen.add(d.key);
      out.push({ ...d, event: e, score: d.score ?? [display(e.homeScore), display(e.awayScore)] });
    }
  }
  pushAlerts(out);
  return { live, fast };
}

/**
 * Watches the favorite teams' games and raises alerts for new events.
 * Returns the favorite team's live game, if any (for the badge on the icon).
 */
export function useMatchWatcher(): MatchEvent | undefined {
  const { favorites } = useSettings();
  const ids = favorites.map((f) => f.id);
  const fast = useRef(false);
  const { data } = useData(
    async () => {
      // Slightly below the poll interval so each poll gets fresh data.
      const r = await poll(ids, (fast.current ? FAST : SLOW) - 2000);
      fast.current = r.fast;
      return r.live;
    },
    [ids.join(",")],
    () => (fast.current ? FAST : SLOW),
  );
  return data;
}
