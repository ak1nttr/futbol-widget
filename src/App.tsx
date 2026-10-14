import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { MatchEvent } from "./api/types";
import { AlertStack } from "./components/Alerts";
import { DemoAlerts, useDemoOnLoad } from "./components/DemoAlerts";
import { Icon, Segmented, TeamLogo } from "./components/ui";
import { useAlerts, useMatchWatcher } from "./lib/alerts";
import { isDesktop, onPointerMove, type PointerPos, setWindowLayout } from "./lib/desktop";
import { type Nav, NavContext, type Route } from "./nav";
import { FavoritesView } from "./views/Favorites";
import { MatchView } from "./views/Match";
import { SettingsView } from "./views/Settings";
import { TeamView } from "./views/Team";
import { TodayView } from "./views/Today";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 450;
/** Matches the panel's CSS transition. */
const PANEL_FADE = 160;
/** Room around the cards for their shadow, in the desktop window. */
const SHADOW_ROOM = 12;
/** Wait for a card's exit animation before shrinking the window. */
const SHRINK_DELAY = 300;

function Bubble({ live, open, ping }: { live?: MatchEvent; open: boolean; ping: boolean }) {
  return (
    <div class={`bubble${open ? " open" : ""}${live ? " has-live" : ""}${ping ? " ping" : ""}`} aria-label="Maçlar">
      {live ? (
        <>
          <TeamLogo id={live.homeTeam.id} size={34} name={live.homeTeam.name} />
          <span class="bubble-score">
            {live.homeScore.display ?? 0}-{live.awayScore.display ?? 0}
          </span>
        </>
      ) : (
        <Icon.ball />
      )}
    </div>
  );
}

export function App() {
  const [stack, setStack] = useState<Route[]>([{ kind: "home" }]);
  const [tab, setTab] = useState<"fav" | "today">("fav");
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const openRef = useRef(open);
  openRef.current = open;
  const live = useMatchWatcher();
  const alerts = useAlerts();
  useDemoOnLoad();
  const [hoveredAlert, setHoveredAlert] = useState<string>();
  /** Window size the alert cards need while the panel is closed (null: none). */
  const alertSize = useRef<{ width: number; height: number } | null>(null);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout>>();

  const nav: Nav = useMemo(
    () => ({
      push: (r) => setStack((s) => [...s, r]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    }),
    [],
  );

  // Hover intent: open shortly after the pointer arrives, close a bit after it leaves
  // both the icon and the panel (so moving between them doesn't flicker).
  // On desktop the native window grows before the panel opens and shrinks after
  // it has faded out, so it never blocks clicks on the rest of the screen.
  const openPanel = async () => {
    clearTimeout(shrinkTimer.current);
    await setWindowLayout("panel");
    setOpen(true);
  };
  const enter = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(openPanel, OPEN_DELAY);
  };
  const leave = () => {
    clearTimeout(timer.current);
    if (pinnedRef.current) return;
    timer.current = setTimeout(() => {
      setOpen(false);
      timer.current = setTimeout(() => setWindowLayout(alertSize.current), PANEL_FADE);
    }, CLOSE_DELAY);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  // The panel opens when the pointer is over the icon (or stays open while it is
  // over the panel). Over an alert card it only pauses that card's timer.
  const overUi = useRef(false);
  const pointerAt = (p: PointerPos) => {
    const el = p && document.elementFromPoint(p.x, p.y);
    const over = !!el?.closest(".bubble, .panel.open");
    if (over !== overUi.current) {
      overUi.current = over;
      over ? enter() : leave();
    }
    setHoveredAlert(el?.closest<HTMLElement>(".alert-slot")?.dataset.key);
  };
  // On desktop the app reports the pointer position (WebView2 hover events are
  // unreliable for a window that never takes focus).
  useEffect(() => onPointerMove(pointerAt), []);

  const onAlertSize = (width: number, height: number) => {
    alertSize.current = height ? { width: width + SHADOW_ROOM, height: height + SHADOW_ROOM } : null;    if (openRef.current) return;
    clearTimeout(shrinkTimer.current);
    // Grow right away; shrink after the closing card has animated out.
    shrinkTimer.current = setTimeout(() => setWindowLayout(alertSize.current), height ? 0 : SHRINK_DELAY);
  };

  // Little bounce of the icon when a new alert comes in.
  const [ping, setPing] = useState(false);
  const newest = alerts[0]?.key;
  useEffect(() => {
    if (!newest) return;
    setPing(true);
    const t = setTimeout(() => setPing(false), 700);
    return () => clearTimeout(t);
  }, [newest]);

  const route = stack[stack.length - 1];
  let body;
  if (route.kind === "team") body = <TeamView key={`t${route.id}`} id={route.id} />;
  else if (route.kind === "match") body = <MatchView key={`m${route.id}`} id={route.id} />;
  else if (route.kind === "settings") body = <SettingsView />;
  else body = tab === "fav" ? <FavoritesView /> : <TodayView />;

  return (
    <NavContext.Provider value={nav}>
      <div
        class="widget"
        onMouseMove={isDesktop ? undefined : (e) => pointerAt({ x: e.clientX, y: e.clientY })}
        onMouseLeave={isDesktop ? undefined : () => pointerAt(null)}
      >
        <div class={`panel${open ? " open" : ""}`} role="dialog" aria-label="Maç paneli" aria-hidden={!open}>
          <header class="panel-head">
            {route.kind === "home" ? (
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  ["fav", "Favorilerim"],
                  ["today", "Bugün"],
                ]}
              />
            ) : (
              <button class="icon-btn back" onClick={nav.back} aria-label="Geri">
                <Icon.back />
                <span>{route.kind === "settings" ? "Ayarlar" : "Geri"}</span>
              </button>
            )}
            <span class="spacer" />
            <button class={`icon-btn${pinned ? " on" : ""}`} onClick={() => setPinned(!pinned)} aria-label="Paneli sabitle" title="Açık tut">
              <Icon.pin />
            </button>
            {route.kind !== "settings" && (
              <button class="icon-btn" onClick={() => nav.push({ kind: "settings" })} aria-label="Ayarlar" title="Ayarlar">
                <Icon.gear />
              </button>
            )}
          </header>
          <div class="panel-body">{body}</div>
        </div>
        <AlertStack alerts={alerts} hidden={open} hoveredKey={hoveredAlert} onSize={onAlertSize} />
        <Bubble live={live} open={open} ping={ping} />
      </div>
      {!isDesktop && <DemoAlerts />}
    </NavContext.Provider>
  );
}
