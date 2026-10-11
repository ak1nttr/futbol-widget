import { useState } from "preact/hooks";
import { getEvent, getIncidents, getLineups } from "../api/sofascore";
import type { Incident, LineupPlayer } from "../api/types";
import { ErrorBox, Loading, PlayerPhoto, RatingBadge, Segmented, TeamLogo } from "../components/ui";
import { STATUS_TR, fmtDay, fmtTime, isLive, liveMinute } from "../lib/format";
import { useData, useTick } from "../lib/useData";
import { useNav } from "../nav";

function incidentLabel(i: Incident): string | null {
  if (i.incidentType === "goal") return i.incidentClass === "ownGoal" ? "⚽ (KK)" : i.incidentClass === "penalty" ? "⚽ (P)" : "⚽";
  if (i.incidentType === "card" && (i.incidentClass === "red" || i.incidentClass === "yellowRed")) return "🟥";
  return null;
}

function Incidents({ items }: { items: Incident[] }) {
  const shown = items.filter((i) => incidentLabel(i)).reverse();
  if (!shown.length) return null;
  return (
    <section class="card incidents">
      {shown.map((i) => (
        <div class={`inc ${i.isHome ? "home" : "away"}`}>
          <span class="inc-min">
            {i.time}'{i.addedTime ? `+${i.addedTime}` : ""}
          </span>
          <span class="inc-txt">
            {incidentLabel(i)} {i.player?.shortName ?? i.playerName ?? ""}
            {i.incidentType === "goal" && i.homeScore != null && (
              <small>
                {" "}
                {i.homeScore}-{i.awayScore}
              </small>
            )}
          </span>
        </div>
      ))}
    </section>
  );
}

function LineupList({ players, best }: { players: LineupPlayer[]; best?: number }) {
  const starters = players.filter((p) => !p.substitute);
  const subs = players.filter((p) => p.substitute && p.statistics?.minutesPlayed);
  const row = (lp: LineupPlayer) => (
    <div class="player">
      <span class="num">{lp.shirtNumber ?? lp.player.jerseyNumber ?? ""}</span>
      <PlayerPhoto id={lp.player.id} />
      <span class="pname">
        {lp.player.shortName ?? lp.player.name}
        {lp.player.id === best && <span class="motm">Maçın oyuncusu</span>}
        <small>
          {[
            lp.statistics?.goals ? `${lp.statistics.goals} gol` : "",
            lp.statistics?.goalAssist ? `${lp.statistics.goalAssist} asist` : "",
            lp.statistics?.minutesPlayed ? `${lp.statistics.minutesPlayed}'` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </small>
      </span>
      <RatingBadge value={lp.statistics?.rating} />
    </div>
  );
  return (
    <div class="list">
      <section class="card">
        <div class="league-head">İlk 11</div>
        <div class="rows">{starters.map(row)}</div>
      </section>
      {subs.length > 0 && (
        <section class="card">
          <div class="league-head">Oyuna girenler</div>
          <div class="rows">{subs.map(row)}</div>
        </section>
      )}
    </div>
  );
}

export function MatchView({ id }: { id: number }) {
  const nav = useNav();
  const [side, setSide] = useState<"home" | "away">("home");
  const { data, error } = useData(
    () => Promise.all([getEvent(id), getLineups(id), getIncidents(id)]).then(([event, lineups, incidents]) => ({ event, lineups, incidents })),
    [id],
    (d) => (d && isLive(d.event) ? 20_000 : 0),
  );
  useTick(30_000);

  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const { event: e, lineups, incidents } = data;
  const live = isLive(e);
  const started = live || e.status.type === "finished";

  const all = lineups ? [...lineups.home.players, ...lineups.away.players] : [];
  const best = all.reduce<LineupPlayer | undefined>((b, p) => ((p.statistics?.rating ?? 0) > (b?.statistics?.rating ?? 0) ? p : b), undefined);

  return (
    <div>
      <div class="scoreboard">
        <small class="sb-comp">
          {e.tournament.uniqueTournament?.name ?? e.tournament.name}
          {e.roundInfo?.round ? ` · ${e.roundInfo.round}. hafta` : ""}
        </small>
        <div class="sb-main">
          <button class="sb-team" onClick={() => nav.push({ kind: "team", id: e.homeTeam.id })}>
            <TeamLogo id={e.homeTeam.id} size={40} name={e.homeTeam.name} />
            <span>{e.homeTeam.shortName ?? e.homeTeam.name}</span>
          </button>
          <div class="sb-score">
            {started ? (
              <b>
                {e.homeScore.display ?? 0} - {e.awayScore.display ?? 0}
              </b>
            ) : (
              <b class="sb-time">{fmtTime(e.startTimestamp)}</b>
            )}
            <small class={live ? "live" : ""}>
              {live ? liveMinute(e) : STATUS_TR[e.status.type] ?? (started ? "Maç sonu" : fmtDay(e.startTimestamp))}
            </small>
          </div>
          <button class="sb-team" onClick={() => nav.push({ kind: "team", id: e.awayTeam.id })}>
            <TeamLogo id={e.awayTeam.id} size={40} name={e.awayTeam.name} />
            <span>{e.awayTeam.shortName ?? e.awayTeam.name}</span>
          </button>
        </div>
      </div>
      <Incidents items={incidents} />
      {lineups ? (
        <>
          <Segmented
            value={side}
            onChange={setSide}
            options={[
              ["home", `${e.homeTeam.shortName ?? e.homeTeam.name}${lineups.home.formation ? ` (${lineups.home.formation})` : ""}`],
              ["away", `${e.awayTeam.shortName ?? e.awayTeam.name}${lineups.away.formation ? ` (${lineups.away.formation})` : ""}`],
            ]}
          />
          {!lineups.confirmed && <div class="note">Muhtemel kadro</div>}
          <LineupList players={lineups[side].players} best={started ? best?.player.id : undefined} />
        </>
      ) : (
        <div class="note">Kadrolar henüz açıklanmadı.</div>
      )}
    </div>
  );
}
