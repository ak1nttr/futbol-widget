import { isDesktop } from "../lib/desktop";
import type { Incident, Lineups, MatchEvent, Player, SeasonRating, Team, UniqueTournament } from "./types";

// All requests go through a local proxy (browser demo: Vite middleware, desktop:
// the app's `sofa://` scheme in Rust), because Sofascore rejects requests coming
// straight from a browser engine.
const BASE = isDesktop ? "http://sofa.localhost/" : "/sofa/";

export const teamImage = (id: number) => `${BASE}team/${id}/image`;
export const playerImage = (id: number) => `${BASE}player/${id}/image`;
export const tournamentImage = (id: number) => `${BASE}unique-tournament/${id}/image`;

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export class NotFound extends Error {}

async function get<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  let p = inflight.get(path);
  if (!p) {
    p = fetch(BASE + path)
      .then(async (r) => {
        if (r.status === 404) throw new NotFound(path);
        if (!r.ok) throw new Error(`Sofascore ${r.status}: ${path}`);
        const data = await r.json();
        cache.set(path, { at: Date.now(), data });
        return data;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p as Promise<T>;
}

// 404 means "no data" for list endpoints (e.g. a team with no upcoming games).
async function list<T>(path: string, key: string, ttlMs: number): Promise<T[]> {
  try {
    const d = await get<Record<string, T[]>>(path, ttlMs);
    return d[key] ?? [];
  } catch (e) {
    if (e instanceof NotFound) return [];
    throw e;
  }
}

const MIN = 60_000;

export const getTeam = (id: number) => get<{ team: Team }>(`team/${id}`, 24 * 60 * MIN).then((d) => d.team);

export const getNextEvents = (teamId: number, ttl = 5 * MIN) =>
  list<MatchEvent>(`team/${teamId}/events/next/0`, "events", ttl);

export const getLastEvents = (teamId: number, ttl = 5 * MIN) =>
  list<MatchEvent>(`team/${teamId}/events/last/0`, "events", ttl);

export const getEvent = (id: number) => get<{ event: MatchEvent }>(`event/${id}`, 15_000).then((d) => d.event);

export const getLineups = async (id: number): Promise<Lineups | null> => {
  try {
    return await get<Lineups>(`event/${id}/lineups`, 30_000);
  } catch (e) {
    if (e instanceof NotFound) return null;
    throw e;
  }
};

export const getIncidents = (id: number) => list<Incident>(`event/${id}/incidents`, "incidents", 15_000);

export const getSquad = (teamId: number) =>
  list<{ player: Player }>(`team/${teamId}/players`, "players", 60 * MIN).then((ps) => ps.map((p) => p.player));

export const getSeasonRatings = async (teamId: number, utId: number, seasonId: number): Promise<SeasonRating[]> => {
  try {
    const d = await get<{ topPlayers: { rating?: SeasonRating[] } }>(
      `team/${teamId}/unique-tournament/${utId}/season/${seasonId}/top-players/overall`,
      60 * MIN,
    );
    return d.topPlayers.rating ?? [];
  } catch (e) {
    if (e instanceof NotFound) return [];
    throw e;
  }
};

export const getTournamentDay = (utId: number, date: string) =>
  list<MatchEvent>(`unique-tournament/${utId}/scheduled-events/${date}`, "events", 60_000);

export const getLiveEvents = () => list<MatchEvent>(`sport/football/events/live`, "events", 20_000);

export const getDefaultTournaments = () =>
  get<{ uniqueTournaments: UniqueTournament[] }>(`config/default-unique-tournaments/TR/football`, 24 * 60 * MIN).then(
    (d) => d.uniqueTournaments,
  );

export const searchTeams = async (q: string): Promise<Team[]> => {
  const d = await get<{ results: { type: string; entity: Team }[] }>(`search/all?q=${encodeURIComponent(q)}`, 10 * MIN);
  return d.results.filter((r) => r.type === "team").map((r) => r.entity);
};
