import { useState } from "preact/hooks";
import { getLastEvents, getNextEvents, getSeasonRatings, getSquad, getTeam } from "../api/sofascore";
import type { MatchEvent, Player } from "../api/types";
import { MatchRow } from "../components/MatchRow";
import { Empty, ErrorBox, Loading, PlayerPhoto, RatingBadge, Segmented, TeamLogo } from "../components/ui";
import { POSITION_TR } from "../lib/format";
import { updateSettings, useSettings } from "../lib/settings";
import { useData } from "../lib/useData";

interface Competition {
  utId: number;
  seasonId: number;
  name: string;
  games: number;
}

/**
 * Competitions the team played in recently, used as the rating source.
 * Only the latest season of each competition is kept; most games first.
 */
function competitionsFrom(events: MatchEvent[]): Competition[] {
  const map = new Map<number, Competition>();
  for (const e of [...events].reverse()) {
    const ut = e.tournament.uniqueTournament;
    if (!ut || !e.season || e.status.type !== "finished") continue;
    const c = map.get(ut.id) ?? { utId: ut.id, seasonId: e.season.id, name: ut.name, games: 0 };
    if (c.seasonId === e.season.id) c.games++;
    map.set(ut.id, c);
  }
  return [...map.values()].sort((a, b) => b.games - a.games);
}

function Matches({ next, last }: { next: MatchEvent[]; last: MatchEvent[] }) {
  return (
    <div class="list">
      {next.length > 0 && (
        <section class="card">
          <div class="league-head">Yaklaşan</div>
          <div class="rows">
            {next.slice(0, 5).map((e) => (
              <MatchRow e={e} showDay />
            ))}
          </div>
        </section>
      )}
      <section class="card">
        <div class="league-head">Geçmiş</div>
        <div class="rows">
          {[...last].reverse().slice(0, 12).map((e) => (
            <MatchRow e={e} showDay />
          ))}
        </div>
      </section>
    </div>
  );
}

function Squad({ teamId, comps }: { teamId: number; comps: Competition[] }) {
  const [compIdx, setCompIdx] = useState(0);
  const comp = comps[compIdx];
  const { data, error } = useData(
    async () => {
      const [squad, ratings] = await Promise.all([
        getSquad(teamId),
        comp ? getSeasonRatings(teamId, comp.utId, comp.seasonId) : Promise.resolve([]),
      ]);
      const byId = new Map(ratings.map((r) => [r.player.id, r.statistics]));
      return squad.map((p) => ({ p, stats: byId.get(p.id) }));
    },
    [teamId, comp?.utId, comp?.seasonId],
  );

  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  if (!data.length) return <Empty>Kadro bilgisi yok.</Empty>;

  const groups: [string, { p: Player; stats?: { rating: number; appearances?: number } }[]][] = ["G", "D", "M", "F"].map(
    (pos) => [
      pos,
      data
        .filter((x) => x.p.position === pos)
        .sort((a, b) => (b.stats?.rating ?? 0) - (a.stats?.rating ?? 0)),
    ],
  );

  return (
    <div class="list">
      {comps.length > 0 && (
        <div class="comp-chips" role="group" aria-label="Rating kaynağı">
          {comps.slice(0, 4).map((c, i) => (
            <button class={`chip${i === compIdx ? " on" : ""}`} onClick={() => setCompIdx(i)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      {groups.map(
        ([pos, players]) =>
          players.length > 0 && (
            <section class="card">
              <div class="league-head">{POSITION_TR[pos]}</div>
              <div class="rows">
                {players.map(({ p, stats }) => (
                  <div class="player">
                    <span class="num">{p.jerseyNumber ?? ""}</span>
                    <PlayerPhoto id={p.id} />
                    <span class="pname">
                      {p.shortName ?? p.name}
                      <small>
                        {p.country?.name}
                        {stats?.appearances ? ` · ${stats.appearances} maç` : ""}
                      </small>
                    </span>
                    <RatingBadge value={stats?.rating} />
                  </div>
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}

export function TeamView({ id }: { id: number }) {
  const [tab, setTab] = useState<"matches" | "squad">("matches");
  const { favorites } = useSettings();
  const isFav = favorites.some((f) => f.id === id);
  const { data, error } = useData(
    () => Promise.all([getTeam(id), getNextEvents(id), getLastEvents(id)]).then(([team, next, last]) => ({ team, next, last })),
    [id],
  );

  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const { team, next, last } = data;

  const toggleFav = () =>
    updateSettings({
      favorites: isFav ? favorites.filter((f) => f.id !== id) : [...favorites, { id, name: team.shortName ?? team.name }],
    });

  return (
    <div>
      <div class="hero" style={{ "--team": team.teamColors?.primary ?? "transparent" }}>
        <TeamLogo id={id} size={44} name={team.name} />
        <div class="hero-text">
          <h2>{team.name}</h2>
          <small>{team.national ? "Milli takım" : team.country?.name}</small>
        </div>
        <button class={`star${isFav ? " on" : ""}`} onClick={toggleFav} aria-label={isFav ? "Favorilerden çıkar" : "Favorilere ekle"}>
          ★
        </button>
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ["matches", "Maçlar"],
          ["squad", "Kadro"],
        ]}
      />
      {tab === "matches" ? <Matches next={next} last={last} /> : <Squad teamId={id} comps={competitionsFrom(last)} />}
    </div>
  );
}
