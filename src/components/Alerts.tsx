import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { type AlertKind, dismissAlert, type MatchAlert } from "../lib/alerts";
import { Icon, TeamLogo } from "./ui";

/** Cards shown at once; the rest wait behind a "+N" chip. */
const VISIBLE = 3;
/** Matches the exit transition in CSS. */
const EXIT_MS = 220;

const whistle = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M9 9h11v4.5a1.5 1.5 0 01-1.5 1.5H16a5.5 5.5 0 11-7-6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
    <circle cx="10.5" cy="15" r="1.6" fill="currentColor" />
    <path d="M13 9V6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
  </svg>
);

function Glyph({ kind }: { kind: AlertKind }) {
  if (kind === "goal" || kind === "goalAgainst") return <Icon.ball />;
  if (kind === "red") return <span class="red-card" />;
  if (kind === "penalty" || kind === "penaltyMissed") return <span class="glyph-text">P</span>;
  if (kind === "goalCancelled") return <span class="glyph-text small">VAR</span>;
  return whistle;
}

function AlertCard({ a, paused, leaving, onClose }: { a: MatchAlert; paused: boolean; leaving: boolean; onClose: () => void }) {
  const e = a.event;
  const [h, w] = a.score;
  return (
    <div class={`alert-slot${leaving ? " leaving" : ""}`} data-key={a.key}>
      <div class={`alert k-${a.kind}${paused ? " paused" : ""}`} role="status">
        <div class="alert-main">
          <span class="alert-glyph">
            <Glyph kind={a.kind} />
          </span>
          <span class="alert-text">
            <span class="alert-title">{a.title}</span>
            <span class="alert-score">
              <TeamLogo id={e.homeTeam.id} size={16} name={e.homeTeam.name} />
              <span class="alert-code">{e.homeTeam.nameCode ?? e.homeTeam.shortName}</span>
              <b class={a.scored === "home" ? "bump" : undefined}>{h}</b>
              <span class="dash">-</span>
              <b class={a.scored === "away" ? "bump" : undefined}>{w}</b>
              <span class="alert-code">{e.awayTeam.nameCode ?? e.awayTeam.shortName}</span>
              <TeamLogo id={e.awayTeam.id} size={16} name={e.awayTeam.name} />
            </span>
            {(a.minute || a.detail) && (
              <span class="alert-detail">
                {a.minute && <span class="alert-min">{a.minute}</span>}
                {a.detail}
              </span>
            )}
          </span>
        </div>
        <button class="alert-close" onClick={onClose} aria-label="Kapat" title="Kapat">
          ×
        </button>
        {/* The bar's animation is the 3-minute timer: pausing it pauses the countdown. */}
        <span class="alert-life" onAnimationEnd={onClose} />
      </div>
    </div>
  );
}

export function AlertStack({
  alerts,
  hidden,
  hoveredKey,
  onSize,
}: {
  alerts: MatchAlert[];
  /** True while the panel is open: cards hide and their timers pause. */
  hidden: boolean;
  hoveredKey?: string;
  /** Reports the area the cards need, measured from the page's top-right corner (0 when empty). */
  onSize: (width: number, height: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  const close = (key: string) => {
    if (leaving.has(key)) return;
    setLeaving((s) => new Set(s).add(key));
    setTimeout(() => {
      dismissAlert(key);
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(key);
        return n;
      });
    }, EXIT_MS);
  };

  const shown = alerts.slice(0, VISIBLE);
  const extra = alerts.length - shown.length;

  // Report size changes so the desktop window can grow to fit the cards.
  const report = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // The cards hang from the top-right corner, so they need their own width plus
    // the gap to the right edge, and everything above their bottom edge.
    const width = r.width + (document.documentElement.clientWidth - r.right);
    onSize(alerts.length ? Math.ceil(width) : 0, alerts.length ? Math.ceil(r.bottom) : 0);
  };
  useLayoutEffect(report, [alerts.length]);
  useEffect(() => {
    const ro = new ResizeObserver(report);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [alerts.length]);

  return (
    <div ref={ref} class={`alerts${hidden ? " hidden" : ""}`} aria-live="polite">
      {shown.map((a) => (
        <AlertCard
          key={a.key}
          a={a}
          paused={hidden || hoveredKey === a.key}
          leaving={leaving.has(a.key)}
          onClose={() => close(a.key)}
        />
      ))}
      {extra > 0 && <div class="alert-more">+{extra} bildirim daha</div>}
    </div>
  );
}
