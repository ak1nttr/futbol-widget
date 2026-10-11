import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getLastEvents, getNextEvents } from "./api/sofascore";
import type { MatchEvent } from "./api/types";
import { Icon, Segmented, TeamLogo } from "./components/ui";
import { isLive } from "./lib/format";
import { useSettings } from "./lib/settings";
import { useData } from "./lib/useData";
import { type Nav, NavContext, type Route } from "./nav";
import { FavoritesView } from "./views/Favorites";
import { MatchView } from "./views/Match";
import { SettingsView } from "./views/Settings";
import { TeamView } from "./views/Team";
import { TodayView } from "./views/Today";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 450;

/** Live games of favorite teams, used for the badge on the floating icon. */
function useFavoriteLive(): MatchEvent | undefined {
  const { favorites } = useSettings();
  const { data } = useData(
    async () => {
      for (const f of favorites) {
        const [next, last] = await Promise.all([getNextEvents(f.id, 60_000), getLastEvents(f.id, 60_000)]);
        const live = [...next, ...last].find(isLive);
        if (live) return live;
      }
      return undefined;
    },
    [favorites.map((f) => f.id).join(",")],
    () => 60_000,
  );
  return data;
}

function Bubble({ live, open }: { live?: MatchEvent; open: boolean }) {
  return (
    <div class={`bubble${open ? " open" : ""}${live ? " has-live" : ""}`} aria-label="Maçlar">
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
  const live = useFavoriteLive();

  const nav: Nav = useMemo(
    () => ({
      push: (r) => setStack((s) => [...s, r]),
      back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    }),
    [],
  );

  // Hover intent: open shortly after the pointer arrives, close a bit after it leaves
  // both the icon and the panel (so moving between them doesn't flicker).
  const enter = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), OPEN_DELAY);
  };
  const leave = () => {
    clearTimeout(timer.current);
    if (!pinned) timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const route = stack[stack.length - 1];
  let body;
  if (route.kind === "team") body = <TeamView key={`t${route.id}`} id={route.id} />;
  else if (route.kind === "match") body = <MatchView key={`m${route.id}`} id={route.id} />;
  else if (route.kind === "settings") body = <SettingsView />;
  else body = tab === "fav" ? <FavoritesView /> : <TodayView />;

  return (
    <NavContext.Provider value={nav}>
      <div class="widget" onMouseEnter={enter} onMouseLeave={leave}>
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
        <Bubble live={live} open={open} />
      </div>
    </NavContext.Provider>
  );
}
