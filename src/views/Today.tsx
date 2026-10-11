import { useMemo, useState } from "preact/hooks";
import { getTournamentDay } from "../api/sofascore";
import type { MatchEvent } from "../api/types";
import { MatchRow } from "../components/MatchRow";
import { Empty, ErrorBox, Loading, TournamentLogo } from "../components/ui";
import { addDays, fmtDayLong, isLive, isoDay } from "../lib/format";
import { useSettings } from "../lib/settings";
import { useData, useTick } from "../lib/useData";

async function loadDay(leagues: number[], day: string) {
  // The API buckets games by UTC date; fetch the day before too and keep
  // only games that fall on `day` in Turkey time.
  const chunks = await Promise.all(
    leagues.flatMap((ut) => [getTournamentDay(ut, addDays(day, -1)), getTournamentDay(ut, day)]),
  );
  const seen = new Set<number>();
  const groups = new Map<number, { name: string; events: MatchEvent[] }>();
  for (const e of chunks.flat()) {
    if (seen.has(e.id) || isoDay(new Date(e.startTimestamp * 1000)) !== day) continue;
    seen.add(e.id);
    const ut = e.tournament.uniqueTournament;
    if (!ut) continue;
    if (!groups.has(ut.id)) groups.set(ut.id, { name: ut.name, events: [] });
    groups.get(ut.id)!.events.push(e);
  }
  for (const g of groups.values()) g.events.sort((a, b) => a.startTimestamp - b.startTimestamp);
  // Keep the user's league order.
  return leagues.filter((id) => groups.has(id)).map((id) => ({ id, ...groups.get(id)! }));
}

export function TodayView() {
  const { leagues, favorites } = useSettings();
  const [day, setDay] = useState(() => isoDay(new Date()));
  const [onlyLive, setOnlyLive] = useState(false);
  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  const { data, error, loading } = useData(
    () => loadDay(leagues, day),
    [leagues.join(","), day],
    (d) => (d?.some((g) => g.events.some(isLive)) ? 30_000 : 5 * 60_000),
  );
  useTick(30_000);

  const groups = (data ?? [])
    .map((g) => ({ ...g, events: onlyLive ? g.events.filter(isLive) : g.events }))
    .filter((g) => g.events.length);
  const liveCount = (data ?? []).reduce((n, g) => n + g.events.filter(isLive).length, 0);

  return (
    <div class="list">
      <div class="daybar">
        <button class="icon-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Önceki gün">
          ‹
        </button>
        <span class="day">{fmtDayLong(day)}</span>
        <button class="icon-btn" onClick={() => setDay(addDays(day, 1))} aria-label="Sonraki gün">
          ›
        </button>
        <button class={`chip${onlyLive ? " on" : ""}`} onClick={() => setOnlyLive(!onlyLive)}>
          <span class="live-dot" /> Canlı {liveCount > 0 && <b>{liveCount}</b>}
        </button>
      </div>
      {error && !data && <ErrorBox error={error} />}
      {loading && !data && <Loading />}
      {data && !groups.length && <Empty>{onlyLive ? "Şu an canlı maç yok." : "Seçili liglerde bu gün maç yok."}</Empty>}
      {groups.map((g) => (
        <section class="card">
          <div class="league-head">
            <TournamentLogo id={g.id} />
            {g.name}
          </div>
          <div class="rows">
            {g.events.map((e) => (
              <MatchRow e={e} favIds={favIds} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
