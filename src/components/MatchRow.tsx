import type { MatchEvent, Team } from "../api/types";
import { STATUS_TR, fmtDay, fmtTime, isFinished, isLive, liveMinute } from "../lib/format";
import { useNav } from "../nav";
import { TeamLogo } from "./ui";

function TeamLine({ team, score, bold, fav }: { team: Team; score?: number; bold: boolean; fav: boolean }) {
  return (
    <div class={`tl${bold ? " win" : ""}`}>
      <TeamLogo id={team.id} size={18} name={team.name} />
      <span class="tl-name">
        {team.shortName ?? team.name}
        {fav && <span class="fav-dot" title="Favori" />}
      </span>
      <span class="tl-score">{score ?? ""}</span>
    </div>
  );
}

/** One fixture row: status column on the left, two team lines with scores on the right. */
export function MatchRow({ e, showDay, favIds }: { e: MatchEvent; showDay?: boolean; favIds?: Set<number> }) {
  const nav = useNav();
  const live = isLive(e);
  const done = isFinished(e);
  const started = live || done;
  const hs = started ? e.homeScore.display ?? e.homeScore.current : undefined;
  const as = started ? e.awayScore.display ?? e.awayScore.current : undefined;

  let status;
  if (live) status = <span class="st live">{liveMinute(e)}</span>;
  else if (STATUS_TR[e.status.type]) status = <span class="st muted">{STATUS_TR[e.status.type]}</span>;
  else
    status = (
      <span class="st">
        {showDay && <small>{fmtDay(e.startTimestamp)}</small>}
        {done ? <span class="muted">MS</span> : fmtTime(e.startTimestamp)}
      </span>
    );

  return (
    <button class={`match${live ? " is-live" : ""}`} onClick={() => nav.push({ kind: "match", id: e.id })}>
      {status}
      <div class="teams">
        <TeamLine team={e.homeTeam} score={hs} bold={e.winnerCode === 1} fav={!!favIds?.has(e.homeTeam.id)} />
        <TeamLine team={e.awayTeam} score={as} bold={e.winnerCode === 2} fav={!!favIds?.has(e.awayTeam.id)} />
      </div>
    </button>
  );
}
