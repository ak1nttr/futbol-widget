import { useRef } from "preact/hooks";
import { getLastEvents, getNextEvents } from "../api/sofascore";
import { MatchRow } from "../components/MatchRow";
import { Empty, ErrorBox, Loading, TeamLogo } from "../components/ui";
import { isLive, resultFor } from "../lib/format";
import { type FavTeam, useSettings } from "../lib/settings";
import { useData, useTick } from "../lib/useData";
import { useNav } from "../nav";

function FavTeamCard({ team }: { team: FavTeam }) {
  const nav = useNav();
  const liveRef = useRef(false);
  const { data, error } = useData(
    async () => {
      // Poll quickly only while this team is playing.
      const ttl = liveRef.current ? 20_000 : 5 * 60_000;
      const [next, last] = await Promise.all([getNextEvents(team.id, ttl), getLastEvents(team.id, ttl)]);
      liveRef.current = next.some(isLive) || last.some(isLive);
      return { next, last };
    },
    [team.id],
    () => (liveRef.current ? 20_000 : 5 * 60_000),
  );
  useTick(30_000);

  const all = data ? [...data.last, ...data.next] : [];
  const live = all.find(isLive);
  const upcoming = data?.next.find((e) => e.status.type === "notstarted" && e.id !== live?.id);
  const finished = data?.last.filter((e) => e.status.type === "finished") ?? [];
  const lastGame = finished[finished.length - 1];
  const form = finished.slice(-5);

  return (
    <section class={`card${live ? " has-live" : ""}`}>
      <button class="card-head" onClick={() => nav.push({ kind: "team", id: team.id })}>
        <TeamLogo id={team.id} size={24} name={team.name} />
        <span class="card-title">{team.name}</span>
        <span class="form" aria-label="Son 5 maç">
          {form.map((e) => {
            const r = resultFor(e, team.id);
            return <span class={`f f-${r}`} title={`${e.homeTeam.shortName} ${e.homeScore.display}-${e.awayScore.display} ${e.awayTeam.shortName}`}>{r}</span>;
          })}
        </span>
      </button>
      {error && !data && <ErrorBox error={error} />}
      {!data && !error && <Loading />}
      {data && (
        <div class="rows">
          {live && <MatchRow e={live} />}
          {upcoming && (
            <>
              <div class="row-label">Sıradaki · {upcoming.tournament.uniqueTournament?.name ?? upcoming.tournament.name}</div>
              <MatchRow e={upcoming} showDay />
            </>
          )}
          {lastGame && !live && (
            <>
              <div class="row-label">Son maç · {lastGame.tournament.uniqueTournament?.name ?? lastGame.tournament.name}</div>
              <MatchRow e={lastGame} showDay />
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function FavoritesView() {
  const { favorites } = useSettings();
  const nav = useNav();
  if (!favorites.length)
    return (
      <Empty>
        Henüz favori takım yok.
        <button class="link" onClick={() => nav.push({ kind: "settings" })}>
          Takım ekle
        </button>
      </Empty>
    );
  return (
    <div class="list">
      {favorites.map((t) => (
        <FavTeamCard key={t.id} team={t} />
      ))}
    </div>
  );
}
