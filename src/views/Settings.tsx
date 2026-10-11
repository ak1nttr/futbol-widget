import { useEffect, useState } from "preact/hooks";
import { getDefaultTournaments, searchTeams } from "../api/sofascore";
import type { Team } from "../api/types";
import { ErrorBox, Loading, TeamLogo, TournamentLogo } from "../components/ui";
import { updateSettings, useSettings } from "../lib/settings";
import { useData } from "../lib/useData";

function TeamSearch() {
  const { favorites } = useSettings();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);
  const { data, loading } = useData(() => (debounced.length >= 2 ? searchTeams(debounced) : Promise.resolve([])), [debounced]);

  const add = (t: Team) => {
    if (!favorites.some((f) => f.id === t.id)) updateSettings({ favorites: [...favorites, { id: t.id, name: t.shortName ?? t.name }] });
    setQ("");
  };

  return (
    <div>
      <input class="search" type="search" placeholder="Takım ara (ör. Galatasaray, Real Madrid)" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      {debounced.length >= 2 && loading && !data?.length && <Loading />}
      {debounced.length >= 2 && (
        <div class="rows">
          {(data ?? [])
            .filter((t) => t.gender !== "F")
            .slice(0, 6)
            .map((t) => {
              const added = favorites.some((f) => f.id === t.id);
              return (
                <button class="setting-row" disabled={added} onClick={() => add(t)}>
                  <TeamLogo id={t.id} size={22} name={t.name} />
                  <span class="pname">
                    {t.name}
                    <small>{t.national ? "Milli takım" : t.country?.name}</small>
                  </span>
                  <span class="add">{added ? "Ekli" : "+ Ekle"}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

export function SettingsView() {
  const { favorites, leagues } = useSettings();
  const tournaments = useData(getDefaultTournaments, []);

  const move = (i: number, d: -1 | 1) => {
    const next = [...favorites];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updateSettings({ favorites: next });
  };

  const toggleLeague = (id: number) =>
    updateSettings({ leagues: leagues.includes(id) ? leagues.filter((l) => l !== id) : [...leagues, id] });

  return (
    <div class="list">
      <section class="card">
        <div class="league-head">Favori takımlar</div>
        <div class="rows">
          {favorites.map((f, i) => (
            <div class="setting-row">
              <TeamLogo id={f.id} size={22} name={f.name} />
              <span class="pname">{f.name}</span>
              <button class="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yukarı taşı">
                ↑
              </button>
              <button class="icon-btn" onClick={() => move(i, 1)} disabled={i === favorites.length - 1} aria-label="Aşağı taşı">
                ↓
              </button>
              <button class="icon-btn danger" onClick={() => updateSettings({ favorites: favorites.filter((x) => x.id !== f.id) })} aria-label="Kaldır">
                ×
              </button>
            </div>
          ))}
        </div>
        <TeamSearch />
      </section>
      <section class="card">
        <div class="league-head">"Bugün" sekmesindeki ligler</div>
        {tournaments.error && !tournaments.data && <ErrorBox error={tournaments.error} />}
        {!tournaments.data && !tournaments.error && <Loading />}
        <div class="rows">
          {tournaments.data?.map((t) => (
            <label class="setting-row">
              <TournamentLogo id={t.id} size={20} />
              <span class="pname">
                {t.name}
                <small>{t.category?.name}</small>
              </span>
              <input type="checkbox" checked={leagues.includes(t.id)} onChange={() => toggleLeague(t.id)} />
            </label>
          ))}
        </div>
      </section>
      <p class="footnote">Veriler Sofascore'dan alınır. Resmi bir Sofascore uygulaması değildir.</p>
    </div>
  );
}
