import type { LineupPlayer } from "../api/types";
import { ratingClass } from "../lib/format";
import { PlayerPhoto } from "./ui";

export interface PitchSide {
  players: LineupPlayer[];
  formation?: string;
}

/**
 * Splits starters into lines, goalkeeper first. Sofascore lists starters as
 * GK, then each formation line in order, each line from right to left.
 */
function toLines({ players, formation }: PitchSide): LineupPlayer[][] {
  const starters = players.filter((p) => !p.substitute);
  const counts = formation?.split("-").map(Number) ?? [];
  if (counts.length && !counts.some(Number.isNaN) && 1 + counts.reduce((a, b) => a + b, 0) === starters.length) {
    const lines: LineupPlayer[][] = [starters.slice(0, 1)];
    let i = 1;
    for (const n of counts) {
      lines.push(starters.slice(i, i + n));
      i += n;
    }
    return lines;
  }
  // No usable formation: group by position.
  return ["G", "D", "M", "F"].map((pos) => starters.filter((p) => (p.position ?? p.player.position) === pos)).filter((l) => l.length);
}

const lastName = (p: LineupPlayer) => {
  const n = p.player.shortName ?? p.player.name;
  return n.includes(". ") ? n.slice(n.lastIndexOf(". ") + 2) : n;
};

function Marker({ p, best }: { p: LineupPlayer; best: boolean }) {
  const r = p.statistics?.rating;
  const goals = p.statistics?.goals ?? 0;
  return (
    <div class="pm" title={p.player.name}>
      <div class="pm-photo">
        <PlayerPhoto id={p.player.id} size={30} />
        {r != null && <span class={`pm-rating ${ratingClass(r)}${best ? " best" : ""}`}>{r.toFixed(1)}</span>}
        {goals > 0 && <span class="pm-goals">{goals > 1 ? `⚽${goals}` : "⚽"}</span>}
      </div>
      <span class="pm-name">
        <b>{p.shirtNumber ?? p.player.jerseyNumber}</b> {lastName(p)}
      </span>
    </div>
  );
}

/** Half of the pitch. `attacksUp`: goalkeeper at the bottom, forwards at the top. */
function Half({ side, attacksUp, bestId }: { side: PitchSide; attacksUp: boolean; bestId?: number }) {
  const lines = toLines(side);
  return (
    <div class={`half${attacksUp ? " up" : ""}`}>
      {lines.map((line) => (
        // Lines are listed right-to-left from the team's view. Attacking up,
        // the team's right is the screen's right, so reverse them.
        <div class="pitch-line">
          {(attacksUp ? [...line].reverse() : line).map((p) => (
            <Marker p={p} best={p.player.id === bestId} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Starting XIs on a vertical pitch. With two sides, `top` attacks down and
 * `bottom` attacks up; with one side it uses the whole pitch.
 */
export function Pitch({ top, bottom, bestId }: { top?: PitchSide; bottom: PitchSide; bestId?: number }) {
  return (
    <div class={`pitch${top ? "" : " single"}`}>
      <svg class="pitch-marks" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
        <rect x="2" y="2" width="96" height="146" />
        <line x1="2" y1="75" x2="98" y2="75" />
        <circle cx="50" cy="75" r="11" />
        <rect x="24" y="2" width="52" height="20" />
        <rect x="38" y="2" width="24" height="7" />
        <rect x="24" y="128" width="52" height="20" />
        <rect x="38" y="141" width="24" height="7" />
      </svg>
      {top && <Half side={top} attacksUp={false} bestId={bestId} />}
      <Half side={bottom} attacksUp bestId={bestId} />
    </div>
  );
}
