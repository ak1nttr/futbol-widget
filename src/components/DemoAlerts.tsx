import { useEffect, useRef } from "preact/hooks";
import type { MatchEvent } from "../api/types";
import { type MatchAlert, pushAlerts } from "../lib/alerts";

// Browser demo only: buttons that fire made-up alerts, to try the cards and sounds.

const event = (h: number, a: number): MatchEvent => ({
  id: 1,
  startTimestamp: Date.now() / 1000,
  status: { code: 7, description: "2nd half", type: "inprogress" },
  homeTeam: { id: 3050, name: "Beşiktaş", shortName: "Beşiktaş", nameCode: "BJK" },
  awayTeam: { id: 3061, name: "Galatasaray", shortName: "Galatasaray", nameCode: "GS" },
  homeScore: { display: h },
  awayScore: { display: a },
  tournament: { name: "Trendyol Süper Lig", uniqueTournament: { id: 52, name: "Trendyol Süper Lig" } },
});

type Sample = Omit<MatchAlert, "key" | "event">;

const SAMPLES: [string, Sample][] = [
  ["Gol", { kind: "goal", title: "GOL! Beşiktaş", minute: "67'", detail: "C. Immobile", score: [2, 1], scored: "home" }],
  ["Rakip gol", { kind: "goalAgainst", title: "Gol · Galatasaray", minute: "71'", detail: "V. Osimhen", score: [2, 2], scored: "away" }],
  ["Kırmızı kart", { kind: "red", title: "Kırmızı kart", minute: "58'", detail: "D. Sánchez · Galatasaray", score: [1, 1] }],
  ["Penaltı", { kind: "penalty", title: "Penaltı · Beşiktaş", minute: "80'", detail: "VAR kararıyla verildi", score: [2, 2] }],
  ["Penaltı kaçtı", { kind: "penaltyMissed", title: "Penaltı kaçtı · Beşiktaş", minute: "81'", detail: "C. Immobile · Kaleci kurtardı", score: [2, 2] }],
  ["Gol iptal", { kind: "goalCancelled", title: "Gol iptal · Galatasaray", minute: "88'", detail: "VAR · M. Icardi", score: [2, 2] }],
  ["Maç başladı", { kind: "start", title: "Maç başladı", detail: "Trendyol Süper Lig", score: [0, 0] }],
  ["Maç bitti", { kind: "end", title: "Maç bitti", detail: "Galibiyet", score: [3, 2] }],
];

let n = 0;
const fire = (s: Sample) => pushAlerts([{ ...s, key: `demo:${n++}`, event: event(...s.score) }]);

/**
 * Fires a few sample alerts on load when the URL has "#bildirim" (browser demo)
 * or the app runs with VITE_DEMO_ALERTS=1 (desktop dev build).
 */
export function useDemoOnLoad() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || (location.hash !== "#bildirim" && !import.meta.env.VITE_DEMO_ALERTS)) return;
    done.current = true;
    fire(SAMPLES[6][1]);
    fire(SAMPLES[2][1]);
    fire(SAMPLES[0][1]);
  }, []);
}

export function DemoAlerts() {
  return (
    <div class="demo-alerts">
      <span>Test bildirimi:</span>
      {SAMPLES.map(([label, s]) => (
        <button onClick={() => fire(s)}>{label}</button>
      ))}
    </div>
  );
}
